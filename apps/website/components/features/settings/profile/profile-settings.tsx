"use client"

import { useState, useEffect, useRef } from "react"
import { Camera, Check, Pencil, User, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useLoadingState } from "@/lib/loading-state/hooks"
import { translateErrorFromResponse } from "@/lib/error-translations"
import { getApiBaseUrl } from "@/lib/api/base-url"

type ProfileSettingsProps = {
  user: {
    id: string
    name: string
    username?: string | null
    displayUsername?: string | null
    email: string
    image?: string | null
    emailVerified: boolean
    createdAt: Date
  }
  onUpdateProfile?: (data: { name: string; image?: string | null }) => Promise<void>
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date)
}

export function ProfileSettings({ user, onUpdateProfile }: ProfileSettingsProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(user.name)
  const [imagePreview, setImagePreview] = useState(user.image || "")
  const { isLoading, setLoading, setSuccess, setError, setIdle } = useLoadingState()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setName(user.name)
    setImagePreview(user.image || "")
  }, [user.name, user.image])

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U"

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name cannot be empty", "MISSING_REQUIRED_FIELD")
      return
    }

    if (name.trim() === user.name) {
      setIsEditing(false)
      return
    }

    setLoading("Updating profile...")
    try {
      await onUpdateProfile?.({ name: name.trim() })
      setIsEditing(false)
      setSuccess("Profile updated successfully")
    } catch (error) {
      const errorTranslation = translateErrorFromResponse(
        error,
        "Failed to update profile"
      )
      setError(errorTranslation.message, errorTranslation.message)
      setName(user.name)
    } finally {
      setIdle()
    }
  }

  const handleCancel = () => {
    setName(user.name)
    setIsEditing(false)
  }

  const uploadProfileImage = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch(`${getApiBaseUrl()}/api/uploads/profile-picture`, {
      method: "POST",
      body: formData,
      credentials: "include",
    })

    const payload = (await response.json()) as { url?: string; error?: string }
    if (!response.ok || !payload.url) {
      throw new Error(payload.error || "Failed to upload image")
    }

    return payload.url
  }

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file", "INVALID_FILE_TYPE")
      return
    }

    const maxSizeBytes = 2 * 1024 * 1024
    if (file.size > maxSizeBytes) {
      setError("Image must be smaller than 2MB", "FILE_TOO_LARGE")
      return
    }

    setLoading("Uploading profile image...")
    try {
      const imageUrl = await uploadProfileImage(file)
      await onUpdateProfile?.({ name: user.name, image: imageUrl })
      setImagePreview(imageUrl)
      setSuccess("Profile image updated successfully")
    } catch (error) {
      const errorTranslation = translateErrorFromResponse(
        error,
        "Failed to update profile image"
      )
      setError(errorTranslation.message, errorTranslation.message)
      setImagePreview(user.image || "")
    } finally {
      setIdle()
    }
  }

  const handleImageRemove = async () => {
    setLoading("Removing profile image...")
    try {
      await onUpdateProfile?.({ name: user.name, image: null })
      setImagePreview("")
      setSuccess("Profile image removed")
    } catch (error) {
      const errorTranslation = translateErrorFromResponse(
        error,
        "Failed to remove profile image"
      )
      setError(errorTranslation.message, errorTranslation.message)
      setImagePreview(user.image || "")
    } finally {
      setIdle()
    }
  }

  return (
    <div className="grid gap-4 sm:gap-6 rounded-lg border p-4 sm:p-6 text-sm">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <User className="size-4 text-muted-foreground" />
          <h3 className="font-medium">Profile information</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          View and update your profile details.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
        <div className="relative flex-shrink-0">
          <Avatar className="size-20 sm:size-24">
            <AvatarImage src={imagePreview || undefined} alt={user.name} />
            <AvatarFallback className="text-base sm:text-lg">{initials}</AvatarFallback>
          </Avatar>
          <Button
            variant="secondary"
            size="icon"
            className="absolute -bottom-1 -right-1 size-6 sm:size-7 rounded-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            <Camera className="size-3 sm:size-3.5" />
          </Button>
          {imagePreview && (
            <Button
              variant="destructive"
              size="icon"
              className="absolute -top-1 -right-1 size-5 sm:size-6 rounded-full"
              onClick={handleImageRemove}
              disabled={isLoading}
            >
              <X className="size-2.5 sm:size-3" />
            </Button>
          )}
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                handleImageUpload(file)
              }
              event.target.value = ""
            }}
          />
        </div>

        <div className="flex-1 w-full space-y-3 sm:space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Name
            </Label>
            {isEditing ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 flex-1 min-w-[200px]"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 flex-shrink-0 text-green-600 hover:text-green-700"
                  onClick={handleSave}
                  disabled={isLoading}
                >
                  <Check className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 flex-shrink-0 text-muted-foreground"
                  onClick={handleCancel}
                  disabled={isLoading}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium break-words flex-1 min-w-0">{user.name}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 flex-shrink-0"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="size-3" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Username
            </Label>
            <p className="font-medium break-words">{user.username || "Not set"}</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Email
            </Label>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium break-all flex-1 min-w-0">{user.email}</p>
              {user.emailVerified ? (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex-shrink-0 bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400 border-green-500/20 dark:border-green-500/30">
                  Verified
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex-shrink-0 bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/30">
                  Unverified
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Member since
            </Label>
            <p className="font-medium break-words">{formatDate(user.createdAt)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
