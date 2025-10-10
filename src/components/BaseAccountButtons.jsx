'use client'

import React from 'react'
import { SignInWithBaseButton as OfficialSignInButton, BasePayButton as OfficialPayButton } from '@base-org/account-ui/react'

// Re-export the official components with our custom props
export const SignInWithBaseButton = ({ onClick, disabled = false, className = '', ...props }) => {
  return (
    <OfficialSignInButton 
      align="center"
      variant="solid"
      colorScheme="light"
      size="medium"
      onClick={onClick}
      disabled={disabled}
      className={className}
      {...props}
    />
  )
}

export const BasePayButton = ({ onClick, disabled = false, className = '', ...props }) => {
  return (
    <OfficialPayButton 
      colorScheme="light"
      onClick={onClick}
      disabled={disabled}
      className={className}
      {...props}
    />
  )
}
