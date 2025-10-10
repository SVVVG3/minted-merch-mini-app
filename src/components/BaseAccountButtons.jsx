'use client'

import React from 'react'

// Sign in with Base Button - following official brand guidelines
export const SignInWithBaseButton = ({ colorScheme = 'light', onClick, disabled = false, className = '' }) => {
  const isLight = colorScheme === 'light'
  
  return (
    <button 
      type="button" 
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg cursor-pointer font-medium text-sm min-w-[180px] h-11 transition-colors ${className}`}
      style={{
        backgroundColor: isLight ? '#ffffff' : '#000000',
        color: isLight ? '#000000' : '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontWeight: '500',
        border: 'none'
      }}
    >
      {/* Base Square Logo */}
      <div 
        className="w-4 h-4 rounded-sm flex-shrink-0"
        style={{
          backgroundColor: isLight ? '#0000FF' : '#FFFFFF'
        }}
      />
      <span>Sign in with Base</span>
    </button>
  )
}

// Base Pay Button - following official brand guidelines
export const BasePayButton = ({ colorScheme = 'light', onClick, disabled = false, className = '' }) => {
  const isLight = colorScheme === 'light'
  
  return (
    <button 
      type="button" 
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center px-4 py-3 rounded-lg cursor-pointer min-w-[180px] h-11 transition-colors ${className}`}
      style={{
        backgroundColor: isLight ? '#ffffff' : '#0000FF',
        border: 'none',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      {/* Base Pay Logo */}
      <img 
        src={isLight ? '/images/base-account/BasePayBlueLogo.png' : '/images/base-account/BasePayWhiteLogo.png'} 
        alt="Base Pay" 
        className="h-5 w-auto"
        style={{ height: '20px' }}
      />
    </button>
  )
}
