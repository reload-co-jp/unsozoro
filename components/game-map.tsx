"use client"

import "leaflet/dist/leaflet.css"
import type * as Leaflet from "leaflet"
import { useEffect, useRef, useState } from "react"

export type Coordinate = [number, number]

export type MapCheckpoint = {
  id: number
  name: string
  longitude: number
  latitude: number
  found: boolean
}

type Props = {
  className: string
  route: Coordinate[]
  checkpoints: MapCheckpoint[]
  currentLocation: Coordinate | null
  visitedCells: Set<string>
  cellSize: number
  bounds: [number, number, number, number]
}

// 移動・ズーム許容範囲をコース範囲より一回り広げる比率
const BOUNDS_EXPAND_RATIO = 0.35

const toLatLng = ([longitude, latitude]: Coordinate): Leaflet.LatLngTuple => [latitude, longitude]

const checkpointStyle = (found: boolean): Leaflet.CircleMarkerOptions => ({
  radius: 8,
  color: "#21282f",
  weight: 2,
  fillColor: found ? "#1e9d69" : "#f4bb38",
  fillOpacity: 1,
})

const expandBounds = ([minLng, minLat, maxLng, maxLat]: Props["bounds"]): Props["bounds"] => {
  const padLng = (maxLng - minLng) * BOUNDS_EXPAND_RATIO
  const padLat = (maxLat - minLat) * BOUNDS_EXPAND_RATIO
  return [minLng - padLng, minLat - padLat, maxLng + padLng, maxLat + padLat]
}

const blurPaneStyle = "position:absolute;pointer-events:none;z-index:450;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);background:rgba(86,97,107,0.58);"

export const GameMap = ({ className, route, checkpoints, currentLocation, visitedCells, cellSize, bounds }: Props) => {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<Leaflet.Map | null>(null)
  const L = useRef<typeof Leaflet | null>(null)
  const fogLayer = useRef<Leaflet.LayerGroup | null>(null)
  const checkpointLayer = useRef<Leaflet.LayerGroup | null>(null)
  const checkpointMarkers = useRef<Map<number, Leaflet.CircleMarker>>(new Map())
  const playerHalo = useRef<Leaflet.CircleMarker | null>(null)
  const playerMarker = useRef<Leaflet.CircleMarker | null>(null)
  const blurPanes = useRef<{ top: HTMLDivElement; bottom: HTMLDivElement; left: HTMLDivElement; right: HTMLDivElement } | null>(null)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    if (!container.current || map.current) return
    let cancelled = false
    import("leaflet").then((leaflet) => {
      if (cancelled || !container.current || map.current) return
      const leafletLib = leaflet.default
      L.current = leafletLib
      const instance = leafletLib.map(container.current, { attributionControl: false, zoomControl: false, maxBoundsViscosity: 1, zoomSnap: 0.25, zoomDelta: 0.25 })
      leafletLib.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 19 }).addTo(instance)
      leafletLib.control.attribution({ prefix: false, position: "bottomright" }).addTo(instance)
      const panes = { top: document.createElement("div"), bottom: document.createElement("div"), left: document.createElement("div"), right: document.createElement("div") }
      Object.values(panes).forEach((pane) => { pane.setAttribute("style", blurPaneStyle); container.current!.appendChild(pane) })
      blurPanes.current = panes
      map.current = instance
      setMapReady(true)
    })
    return () => {
      cancelled = true
      Object.values(blurPanes.current ?? {}).forEach((pane) => pane.remove())
      blurPanes.current = null
      map.current?.remove()
      map.current = null
      fogLayer.current = null
      checkpointLayer.current = null
      checkpointMarkers.current.clear()
      playerHalo.current = null
      playerMarker.current = null
      setMapReady(false)
    }
  }, [])

  useEffect(() => {
    const instance = map.current
    if (!instance || !container.current) return
    // 画面回転などでコンテナサイズが変わった際、Leafletに追従させてズレを防ぐ
    const observer = new ResizeObserver(() => instance.invalidateSize())
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [mapReady])

  useEffect(() => {
    const instance = map.current
    const leafletLib = L.current
    if (!instance || !leafletLib || !route.length) return
    const courseBounds: Leaflet.LatLngBoundsExpression = [[bounds[1], bounds[0]], [bounds[3], bounds[2]]]
    instance.fitBounds(courseBounds, { padding: [56, 56], animate: false })
    const [expandedMinLng, expandedMinLat, expandedMaxLng, expandedMaxLat] = expandBounds(bounds)
    const allowedBounds: Leaflet.LatLngBoundsExpression = [[expandedMinLat, expandedMinLng], [expandedMaxLat, expandedMaxLng]]
    instance.setMinZoom(instance.getBoundsZoom(allowedBounds))
    instance.setMaxBounds(allowedBounds)
    const bufferStyle: Leaflet.PolylineOptions = { color: "transparent", weight: 0, fillColor: "#56616b", fillOpacity: 0.58, interactive: false }
    leafletLib.rectangle([[bounds[3], expandedMinLng], [expandedMaxLat, expandedMaxLng]], bufferStyle).addTo(instance)
    leafletLib.rectangle([[expandedMinLat, expandedMinLng], [bounds[1], expandedMaxLng]], bufferStyle).addTo(instance)
    leafletLib.rectangle([[bounds[1], expandedMinLng], [bounds[3], bounds[0]]], bufferStyle).addTo(instance)
    leafletLib.rectangle([[bounds[1], bounds[2]], [bounds[3], expandedMaxLng]], bufferStyle).addTo(instance)
    leafletLib.polyline(route.map(toLatLng), { color: "#fff7e7", weight: 8, opacity: 0.82 }).addTo(instance)
    leafletLib.polyline(route.map(toLatLng), { color: "#d74b2a", weight: 4 }).addTo(instance)

    const updateBlurPanes = () => {
      const panes = blurPanes.current
      if (!panes) return
      const nw = instance.latLngToContainerPoint([expandedMaxLat, expandedMinLng])
      const se = instance.latLngToContainerPoint([expandedMinLat, expandedMaxLng])
      const size = instance.getSize()
      const top = Math.max(0, nw.y), bottom = Math.max(0, size.y - se.y), left = Math.max(0, nw.x), right = Math.max(0, size.x - se.x)
      panes.top.setAttribute("style", `${blurPaneStyle}left:0;top:0;width:${size.x}px;height:${top}px;`)
      panes.bottom.setAttribute("style", `${blurPaneStyle}left:0;top:${size.y - bottom}px;width:${size.x}px;height:${bottom}px;`)
      panes.left.setAttribute("style", `${blurPaneStyle}left:0;top:${top}px;width:${left}px;height:${Math.max(0, size.y - top - bottom)}px;`)
      panes.right.setAttribute("style", `${blurPaneStyle}left:${size.x - right}px;top:${top}px;width:${right}px;height:${Math.max(0, size.y - top - bottom)}px;`)
    }
    updateBlurPanes()
    instance.on("move zoom resize", updateBlurPanes)
    return () => { instance.off("move zoom resize", updateBlurPanes) }
  }, [bounds, route, mapReady])

  useEffect(() => {
    const instance = map.current
    const leafletLib = L.current
    if (!instance || !leafletLib) return
    if (!fogLayer.current) fogLayer.current = leafletLib.layerGroup().addTo(instance)
    const layer = fogLayer.current
    layer.clearLayers()
    for (let longitude = bounds[0]; longitude < bounds[2]; longitude += cellSize) {
      for (let latitude = bounds[1]; latitude < bounds[3]; latitude += cellSize) {
        const x = Math.floor((longitude - bounds[0]) / cellSize)
        const y = Math.floor((latitude - bounds[1]) / cellSize)
        if (visitedCells.has(`${x}:${y}`)) continue
        const cellMaxLng = Math.min(longitude + cellSize, bounds[2])
        const cellMaxLat = Math.min(latitude + cellSize, bounds[3])
        leafletLib.rectangle([[latitude, longitude], [cellMaxLat, cellMaxLng]], { color: "transparent", weight: 0, fillColor: "#56616b", fillOpacity: 0.58 }).addTo(layer)
      }
    }
  }, [bounds, cellSize, visitedCells, mapReady])

  useEffect(() => {
    const instance = map.current
    const leafletLib = L.current
    if (!instance || !leafletLib) return
    if (!checkpointLayer.current) checkpointLayer.current = leafletLib.layerGroup().addTo(instance)
    const layer = checkpointLayer.current
    const markers = checkpointMarkers.current
    const seen = new Set<number>()
    checkpoints.forEach((checkpoint) => {
      seen.add(checkpoint.id)
      const existing = markers.get(checkpoint.id)
      if (existing) {
        existing.setLatLng([checkpoint.latitude, checkpoint.longitude])
        existing.setStyle(checkpointStyle(checkpoint.found))
      } else {
        const marker = leafletLib.circleMarker([checkpoint.latitude, checkpoint.longitude], checkpointStyle(checkpoint.found)).addTo(layer)
        markers.set(checkpoint.id, marker)
      }
    })
    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.remove()
        markers.delete(id)
      }
    }
  }, [checkpoints, mapReady])

  useEffect(() => {
    const instance = map.current
    const leafletLib = L.current
    if (!instance || !leafletLib) return
    if (!currentLocation) {
      playerHalo.current?.remove()
      playerMarker.current?.remove()
      playerHalo.current = null
      playerMarker.current = null
      return
    }
    const latLng: Leaflet.LatLngTuple = [currentLocation[1], currentLocation[0]]
    if (!playerHalo.current) {
      playerHalo.current = leafletLib.circleMarker(latLng, { radius: 18, color: "transparent", weight: 0, fillColor: "#2584d8", fillOpacity: 0.18 }).addTo(instance)
    } else {
      playerHalo.current.setLatLng(latLng)
    }
    if (!playerMarker.current) {
      playerMarker.current = leafletLib.circleMarker(latLng, { radius: 8, color: "#fff", weight: 3, fillColor: "#2584d8", fillOpacity: 1 }).addTo(instance)
    } else {
      playerMarker.current.setLatLng(latLng)
    }
  }, [currentLocation, mapReady])

  return <div aria-label="コース地図" className={className} ref={container} />
}
