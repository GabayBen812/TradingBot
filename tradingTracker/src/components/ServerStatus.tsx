import React, { useState, useEffect } from 'react'
import { getBotStatus, getBotMetrics } from '@/services/serverBot'

export function ServerStatus() {
  const [status, setStatus] = useState<any>(null)
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkServer = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const [statusData, metricsData] = await Promise.all([
          getBotStatus(),
          getBotMetrics()
        ])
        
        console.log('Server Status Data:', statusData)
        console.log('Server Metrics Data:', metricsData)
        setStatus(statusData)
        setMetrics(metricsData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        console.error('Server connection failed:', err)
      } finally {
        setLoading(false)
      }
    }

    checkServer()
    
    // Refresh every 30 seconds
    const interval = setInterval(checkServer, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="p-6 bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-blue-400 rounded-xl shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
          <span className="text-blue-100 font-medium text-lg">Connecting to server...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-red-400 rounded-xl shadow-lg">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-4 h-4 bg-red-400 rounded-full"></div>
          <span className="text-red-100 font-bold text-lg">Server Connection Failed</span>
        </div>
        <p className="text-red-200 text-base mt-2 font-medium">{error}</p>
        <p className="text-red-300 text-sm mt-3">
          Make sure the Express.js server is running on port 3001
        </p>
      </div>
    )
  }

  // Debug: Show raw data if available
  if (process.env.NODE_ENV === 'development') {
    console.log('Current Status State:', status)
    console.log('Current Metrics State:', metrics)
  }

  return (
    <div className="p-6 bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-blue-500 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200">
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-4 h-4 bg-blue-400 rounded-full animate-pulse"></div>
        <span className="text-blue-100 font-bold text-lg">Server Connected</span>
      </div>
      
      {status ? (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg border border-slate-600">
            <span className="text-blue-200 font-medium">Status:</span>
            <span className="text-blue-100 font-bold text-base">
              {status.isRunning ? 'Running' : 'Stopped'}
            </span>
          </div>
          <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg border border-slate-600">
            <span className="text-blue-200 font-medium">Uptime:</span>
            <span className="text-blue-100 font-bold text-base">
              {Math.round(status.uptime / 60)}m
            </span>
          </div>
          <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg border border-slate-600">
            <span className="text-blue-200 font-medium">Active Signals:</span>
            <span className="text-blue-100 font-bold text-base">{status.stats?.activeSignals || 0}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg border border-slate-600">
            <span className="text-blue-200 font-medium">Pending Orders:</span>
            <span className="text-blue-100 font-bold text-base">{status.stats?.pendingOrders || 0}</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <p className="text-blue-200 text-sm">Loading status...</p>
        </div>
      )}
      
      {/* Removed duplicate performance metrics - they're already shown above in the main stats */}
    </div>
  )
}
