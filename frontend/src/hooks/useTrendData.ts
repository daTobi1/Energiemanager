import { useState, useEffect, useRef } from 'react'
import { api } from '../api/client'
import type { TrendInterval } from '../types'

export interface TrendDataResponse {
  [key: string]: {
    unit: string
    timestamps: string[]
    values: number[]
    min: number[]
    max: number[]
  }
}

export interface TrendStatsResponse {
  [key: string]: {
    min: number
    max: number
    avg: number
    sum: number
    count: number
  }
}

export function useTrendData(
  sources: string[],
  from: string,
  to: string,
  interval: TrendInterval,
) {
  const [data, setData] = useState<TrendDataResponse | null>(null)
  const [stats, setStats] = useState<TrendStatsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (sources.length === 0 || !from || !to) return

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const sourcesStr = sources.join(',')
        const [trendData, trendStats] = await Promise.all([
          api.trends.data({ sources: sourcesStr, from, to, interval }),
          api.trends.statistics({ sources: sourcesStr, from, to }),
        ])
        setData(trendData)
        setStats(trendStats)
      } catch (err) {
        console.warn('[Trends] Fehler beim Laden:', err)
        setData(null)
        setStats(null)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [sources.join(','), from, to, interval])

  return { data, stats, loading }
}
