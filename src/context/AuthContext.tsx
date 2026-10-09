import React, { createContext, useContext, useState, useEffect } from 'react'
import {
  getToken,
  getUsername,
  setAuthStorage,
  clearAuthStorage,
} from '../lib/api'

interface AuthContextType {
  token: string | null
  currentUser: string | null
  isLoggedIn: boolean
  isAuthModalOpen: boolean
  openAuthModal: () => void
  closeAuthModal: () => void
  login: (token: string, username: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

  useEffect(() => {
    const savedToken = getToken()
    const savedUser = getUsername()
    if (savedToken && savedUser) {
      setToken(savedToken)
      setCurrentUser(savedUser)
    }
  }, [])

  const login = (newToken: string, newUsername: string) => {
    setAuthStorage(newToken, newUsername)
    setToken(newToken)
    setCurrentUser(newUsername)
    setIsAuthModalOpen(false)
  }

  const logout = () => {
    clearAuthStorage()
    setToken(null)
    setCurrentUser(null)
    window.location.reload()
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        currentUser,
        isLoggedIn: Boolean(token && currentUser),
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}