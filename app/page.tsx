"use client"

import { Check, Compass, Crosshair, LoaderCircle, MapPinned, Menu, Navigation, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { GameMap, MapCheckpoint } from "@/components/game-map"
import { loadGame, SavedGame, saveGame } from "./game-storage"
import styles from "./page.module.css"

const API = "https://sozoroto.reload.co.jp/api/courses"
const CELL_SIZE = 0.00032
const GPS_ACCURACY_LIMIT = 70
const LOG_DISTANCE_METERS = 10
const CHECKPOINT_DISTANCE_METERS = 50
const ACTIVE_COURSE_KEY = "unsozoro:active-course"

type CourseSummary = { id: number; title: string; shortDescription: string; distanceMeters: number; durationMinutes: number; areaName: string; mainImageUrl: string }
type Course = CourseSummary & { routeGeoJson?: { coordinates: [number, number][] }; spots: { spot: { id: number; name: string; latitude: number; longitude: number } }[] }
type Coordinates = { latitude: number; longitude: number }
type Position = Coordinates & { accuracy: number; timestamp: number }

const defaultGame = (courseId: number): SavedGame => ({ courseId, startedAt: Date.now(), updatedAt: Date.now(), cleared: false, visitedCells: [], discoveredIds: [], locations: [] })
const distanceInMeters = (first: Coordinates, second: Coordinates) => {
  const radians = (value: number) => (value * Math.PI) / 180
  const latitude = radians(second.latitude - first.latitude)
  const longitude = radians(second.longitude - first.longitude)
  const a = Math.sin(latitude / 2) ** 2 + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(longitude / 2) ** 2
  return 12742000 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
const routeCoordinates = (course: Course): [number, number][] => course.routeGeoJson?.coordinates ?? course.spots.map(({ spot }) => [spot.longitude, spot.latitude] as [number, number])
const courseBounds = (course: Course): [number, number, number, number] => {
  const points = [...routeCoordinates(course), ...course.spots.map(({ spot }) => [spot.longitude, spot.latitude] as [number, number])]
  const longitudes = points.map(([longitude]) => longitude)
  const latitudes = points.map(([, latitude]) => latitude)
  const padding = 0.0012
  return [Math.min(...longitudes) - padding, Math.min(...latitudes) - padding, Math.max(...longitudes) + padding, Math.max(...latitudes) + padding]
}
const imageUrl = (path: string) => `https://sozoroto.reload.co.jp${path}`

export default function Page() {
  const [courses, setCourses] = useState<CourseSummary[]>([])
  const [course, setCourse] = useState<Course | null>(null)
  const [game, setGame] = useState<SavedGame | null>(null)
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null)
  const [menuOpen, setMenuOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingCourse, setLoadingCourse] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [discovery, setDiscovery] = useState<string | null>(null)
  const [tracking, setTracking] = useState(false)
  const [lastLocationAt, setLastLocationAt] = useState<number | null>(null)
  const watchId = useRef<number | null>(null)

  useEffect(() => () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current) }, [])

  const selectCourse = async (id: number) => {
    setLoadingCourse(true); setError(null)
    try {
      const response = await fetch(`${API}/${id}.json`)
      if (!response.ok) throw new Error()
      const nextCourse = await response.json() as Course
      setCourse(nextCourse); setGame(await loadGame(id) ?? defaultGame(id)); setCurrentPosition(null); setMenuOpen(false)
      localStorage.setItem(ACTIVE_COURSE_KEY, String(id))
    } catch { setError("コース情報を取得できませんでした。") } finally { setLoadingCourse(false) }
  }
  useEffect(() => {
    fetch(`${API}/list.json`).then((response) => { if (!response.ok) throw new Error(); return response.json() }).then((items: CourseSummary[]) => {
      setCourses(items)
      const savedCourseId = Number(localStorage.getItem(ACTIVE_COURSE_KEY))
      if (items.some((item) => item.id === savedCourseId)) void selectCourse(savedCourseId)
    }).catch(() => setError("コース一覧を取得できませんでした。通信状態を確認してください。")).finally(() => setLoading(false))
  }, [])
  const updateGame = useCallback((update: (current: SavedGame) => SavedGame) => {
    setGame((current) => {
      if (!current) return current
      const next = { ...update(current), updatedAt: Date.now() }
      void saveGame(next)
      return next
    })
  }, [])
  const recordPosition = useCallback((position: Position) => {
    if (!course || position.accuracy > GPS_ACCURACY_LIMIT) {
      if (position.accuracy > GPS_ACCURACY_LIMIT) setLocationError(`GPS精度 ${Math.round(position.accuracy)}m。精度改善まで踏破記録停止。`)
      return
    }
    const bounds = courseBounds(course)
    if (position.longitude < bounds[0] || position.longitude > bounds[2] || position.latitude < bounds[1] || position.latitude > bounds[3]) {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
      setTracking(false); setCurrentPosition(null)
      setLocationError("現在地がコース範囲外です。コース周辺で開始してください。")
      return
    }
    setLocationError(null); setCurrentPosition(position)
    const cell = `${Math.floor((position.longitude - bounds[0]) / CELL_SIZE)}:${Math.floor((position.latitude - bounds[1]) / CELL_SIZE)}`
    updateGame((current) => {
      const isNewLog = !current.locations.length || distanceInMeters(current.locations[current.locations.length - 1], position) >= LOG_DISTANCE_METERS
      const newlyFound = course.spots.find(({ spot }) => !current.discoveredIds.includes(spot.id) && distanceInMeters(position, spot) <= CHECKPOINT_DISTANCE_METERS)?.spot
      const discoveredIds = newlyFound ? [...current.discoveredIds, newlyFound.id] : current.discoveredIds
      if (newlyFound) setDiscovery(newlyFound.name)
      return { ...current, visitedCells: current.visitedCells.includes(cell) ? current.visitedCells : [...current.visitedCells, cell], discoveredIds, locations: isNewLog ? [...current.locations, position] : current.locations, cleared: discoveredIds.length === course.spots.length }
    })
  }, [course, updateGame])
  const beginLocationTracking = () => {
    if (!navigator.geolocation) { setLocationError("位置情報に対応していないブラウザです。"); return }
    if (!window.isSecureContext) { setLocationError("位置情報はHTTPSまたはlocalhost接続で利用できます。"); return }
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    setLocationError(null)
    setTracking(true)
    watchId.current = navigator.geolocation.watchPosition(
      ({ coords, timestamp }) => {
        setLastLocationAt(timestamp)
        recordPosition({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, timestamp })
      },
      (positionError) => {
        setTracking(false)
        const message = positionError.code === 1 ? "位置情報の利用が拒否されています。ブラウザ設定で許可してください。" : positionError.code === 2 ? "現在地を取得できません。屋外または通信状態を確認してください。" : "位置情報の取得がタイムアウトしました。もう一度お試しください。"
        setLocationError(message)
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 },
    )
  }
  const stopLocationTracking = () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
    setTracking(false)
  }

  const bounds = useMemo(() => course ? courseBounds(course) : null, [course])
  const totalCells = bounds ? Math.ceil((bounds[2] - bounds[0]) / CELL_SIZE) * Math.ceil((bounds[3] - bounds[1]) / CELL_SIZE) : 0
  const exploration = game && totalCells ? Math.round((game.visitedCells.length / totalCells) * 100) : 0
  const checkpoints: MapCheckpoint[] = course && game ? course.spots.map(({ spot }) => ({ id: spot.id, name: spot.name, longitude: spot.longitude, latitude: spot.latitude, found: game.discoveredIds.includes(spot.id) })) : []

  return <main className={styles.app}>
    {course && game && bounds ? <GameMap key={course.id} className={styles.map} route={routeCoordinates(course)} checkpoints={checkpoints} currentLocation={currentPosition ? [currentPosition.longitude, currentPosition.latitude] : null} visitedCells={new Set(game.visitedCells)} cellSize={CELL_SIZE} bounds={bounds} /> : <div className={styles.waiting}><Compass size={32} /><p>{loading ? "コースを読み込み中" : "散歩コースを選択"}</p></div>}
    {course && game && <>
      <header className={styles.topbar}><button className={styles.iconButton} onClick={() => setMenuOpen(true)} aria-label="メニュー"><Menu /></button><div className={styles.courseTitle}><span>{course.areaName}</span><strong>{course.title}</strong></div><button className={styles.iconButton} onClick={beginLocationTracking} aria-label="現在地を取得"><Crosshair /></button></header>
      <section className={styles.hud} aria-label="進行状況"><div><span>CHECKPOINT</span><strong>{game.discoveredIds.length} <i>/</i> {course.spots.length}</strong></div><div><span>EXPLORED</span><strong>{exploration}<i>%</i></strong></div></section>
      <button className={styles.locationButton} onClick={tracking ? stopLocationTracking : beginLocationTracking}><Navigation size={17} /> {tracking ? "位置情報 更新中" : currentPosition ? "現在地を再取得" : "現在地を取得"}</button>
      {tracking && lastLocationAt && <span className={styles.locationUpdated}>最終更新 {new Date(lastLocationAt).toLocaleTimeString("ja-JP")}</span>}
    </>}
    {locationError && <p className={styles.notice}>{locationError}</p>}{error && <p className={`${styles.notice} ${styles.error}`}>{error}</p>}
    {menuOpen && <aside className={styles.menu} aria-label="コースメニュー"><div className={styles.menuHeader}><div><span className={styles.brandMark}>U</span><strong>Unsozoro</strong></div>{course && <button className={styles.iconButton} onClick={() => setMenuOpen(false)} aria-label="閉じる"><X /></button>}</div>{course && <section className={styles.currentCourse}><span>現在のコース</span><strong>{course.title}</strong><small>{Math.round(course.distanceMeters / 100) / 10} km · 約{course.durationMinutes}分</small></section>}<div className={styles.menuLabel}>コースを選ぶ</div><div className={styles.courseList}>{loading ? <div className={styles.loading}><LoaderCircle /> 読み込み中</div> : courses.map((item) => <button className={`${styles.courseRow} ${item.id === course?.id ? styles.activeCourse : ""}`} key={item.id} onClick={() => void selectCourse(item.id)} disabled={loadingCourse}><img src={imageUrl(item.mainImageUrl)} alt="" /><span><strong>{item.title}</strong><small>{item.shortDescription}</small><em>{item.areaName} · {item.durationMinutes}分</em></span></button>)}</div></aside>}
    {discovery && <div className={styles.overlay}><section className={styles.dialog}><div className={styles.dialogIcon}><MapPinned /></div><span>CHECKPOINT DISCOVERED</span><h1>{discovery}</h1><button onClick={() => setDiscovery(null)}>続ける</button></section></div>}
    {course && game?.cleared && !discovery && <div className={styles.overlay}><section className={`${styles.dialog} ${styles.clearDialog}`}><div className={styles.dialogIcon}><Check /></div><span>COURSE CLEAR</span><h1>{course.title}</h1><dl><div><dt>チェックポイント</dt><dd>{course.spots.length} / {course.spots.length}</dd></div><div><dt>踏破率</dt><dd>{exploration}%</dd></div></dl><button onClick={() => setMenuOpen(true)}>コース一覧へ</button></section></div>}
  </main>
}
