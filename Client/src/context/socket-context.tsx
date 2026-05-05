import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '@/context/auth-context'

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

type SocketContextValue = {
  socket: Socket | null
  isConnected: boolean
}

const SocketContext = createContext<SocketContextValue>({ socket: null, isConnected: false })

/**
 * Maintains a single Socket.IO connection scoped to the logged-in user. The
 * socket is torn down on logout and reconnected on login (or token refresh)
 * so we never send messages with a stale identity.
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // No user → make sure any previous socket is torn down.
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setIsConnected(false)
      }
      return
    }

    const token = localStorage.getItem('accessToken')
    if (!token) return

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 5,
    })

    socket.on('connect', () => setIsConnected(true))
    socket.on('disconnect', () => setIsConnected(false))
    socket.on('connect_error', (err) => {
      // eslint-disable-next-line no-console
      console.warn('Chat socket connect_error:', err.message)
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
      setIsConnected(false)
    }
  }, [user])

  const value = useMemo(
    () => ({ socket: socketRef.current, isConnected }),
    // socketRef is mutated in effects, but we want consumers to re-render
    // when the connection state changes — depending on isConnected captures that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isConnected, user?._id],
  )

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

export function useSocket() {
  return useContext(SocketContext)
}
