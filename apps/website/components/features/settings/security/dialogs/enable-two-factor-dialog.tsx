"use client"

import { useState } from "react"
import { Loader2, Copy, Check } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { authClient } from "@/lib/auth/client"
import { useSession } from "@/lib/auth/hooks"
import QRCode from "react-qr-code"
import { useLoadingState } from "@/lib/loading-state/hooks"
import { translateErrorFromResponse } from "@/lib/error-translations"

type Step = "password" | "qr" | "verify" | "backup"

type EnableTwoFactorDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

type TwoFactorEnableData = {
  totpURI?: string
  backupCodes?: string[]
  secret?: string
}

export function EnableTwoFactorDialog({
  open,
  onOpenChange,
  onSuccess,
}: EnableTwoFactorDialogProps) {
  const [step, setStep] = useState<Step>("password")
  const [password, setPassword] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [totpUri, setTotpUri] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [secretCopied, setSecretCopied] = useState(false)
  const { isLoading, setLoading, setIdle, setSuccess, setError } = useLoadingState()
  const queryClient = useQueryClient()
  const { refetch: refetchSession } = useSession()

  const extractSecretFromTotpUri = (uri: string): string | null => {
    try {
      const url = new URL(uri)
      return url.searchParams.get("secret")
    } catch {
      return null
    }
  }

  const handlePasswordSubmit = async () => {
    if (!password.trim()) {
      setError("Please enter your password", "MISSING_REQUIRED_FIELD")
      return
    }

    setLoading("Generating QR code...")
    try {
      const result = await authClient.twoFactor.enable({ password })
      const data = result.data as TwoFactorEnableData | undefined
      if (data?.totpURI) {
        setTotpUri(data.totpURI)
        
        const extractedSecret = extractSecretFromTotpUri(data.totpURI)
        if (extractedSecret) {
          setSecret(extractedSecret)
        } else if (data.secret) {
          setSecret(data.secret)
        }
        
        if (data.backupCodes) {
          setBackupCodes(data.backupCodes)
        }
        setIdle()
        setStep("qr")
      } else {
        setError("Failed to generate QR code", "INTERNAL_SERVER_ERROR")
      }
    } catch (error: unknown) {
      const errorTranslation = translateErrorFromResponse(
        error,
        "Incorrect password. Please try again."
      )
      setError(errorTranslation.message, errorTranslation.message)
    }
  }

  const handleVerifyCode = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      setError("Please enter a 6-digit code", "INVALID_INPUT")
      return
    }

    setLoading("Verifying code...")
    try {
      await authClient.twoFactor.verifyTotp({
        code: verificationCode.trim(),
      })

      setSuccess("Two-factor authentication enabled")
      queryClient.invalidateQueries({ queryKey: ["/api/auth/get-session"] })
      await refetchSession()
      
      if (backupCodes.length > 0) {
        setStep("backup")
      } else {
        handleClose()
        await onSuccess?.()
      }
    } catch (error: unknown) {
      const errorTranslation = translateErrorFromResponse(
        error,
        "Invalid code. Please try again."
      )
      setError(errorTranslation.message, errorTranslation.message)
    }
  }

  const handleCopyBackupCode = async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedIndex(index)
      toast.success("Code copied")
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch {
      toast.error("Failed to copy code")
    }
  }

  const handleCopySecret = async () => {
    if (!secret) return
    try {
      await navigator.clipboard.writeText(secret)
      setSecretCopied(true)
      toast.success("Secret key copied")
      setTimeout(() => setSecretCopied(false), 2000)
    } catch {
      toast.error("Failed to copy secret key")
    }
  }

  const handleContinueFromBackup = async () => {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/get-session"] })
    await refetchSession()
    handleClose()
    await onSuccess?.()
  }

  const handleClose = () => {
    if (!isLoading) {
      setStep("password")
      setPassword("")
      setVerificationCode("")
      setTotpUri(null)
      setSecret(null)
      setBackupCodes([])
      setCopiedIndex(null)
      setSecretCopied(false)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        {step === "password" && (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>Enable two-factor authentication</DialogTitle>
              <DialogDescription>
                Enter your password to continue with the two-factor authentication
                setup.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isLoading && password.trim()) {
                      handlePasswordSubmit()
                    }
                  }}
                  autoFocus
                />
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handlePasswordSubmit} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                Continue
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "qr" && totpUri && (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>Scan QR code</DialogTitle>
              <DialogDescription>
                Scan this code with your authenticator app (Google Authenticator,
                Authy, etc.)
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 flex flex-col items-center gap-4">
              <div className="p-4 bg-white rounded-lg">
                <QRCode value={totpUri} size={200} />
              </div>
              {secret && (
                <div className="w-full space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Can&apos;t scan the QR code? Enter this secret key manually:
                  </p>
                  <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50 w-full">
                    <code className="flex-1 text-sm font-mono text-center break-all">
                      {secret}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 shrink-0"
                      onClick={handleCopySecret}
                    >
                      {secretCopied ? (
                        <Check className="size-4 text-green-600" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep("password")}
                disabled={isLoading}
              >
                Back
              </Button>
              <Button onClick={() => setStep("verify")} disabled={isLoading}>
                Continue
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "verify" && (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>Verify code</DialogTitle>
              <DialogDescription>
                Enter the 6-digit code that appears in your authenticator app to
                complete the setup.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 flex justify-center">
              <InputOTP
                id="verification-code"
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={verificationCode}
                onChange={(value) => setVerificationCode(value)}
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !isLoading &&
                    verificationCode.length === 6
                  ) {
                    handleVerifyCode()
                  }
                }}
              >
                <InputOTPGroup className="gap-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep("qr")}
                disabled={isLoading}
              >
                Back
              </Button>
              <Button
                onClick={handleVerifyCode}
                disabled={isLoading || verificationCode.length !== 6}
              >
                {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                Verify
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "backup" && backupCodes.length > 0 && (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>Backup codes</DialogTitle>
              <DialogDescription>
                Save these codes in a safe place. You can use them to access your
                account if you lose access to your authenticator app.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-2">
              {backupCodes.map((code, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-2 p-2 rounded-md border bg-muted/50"
                >
                  <code className="text-sm font-mono">{code}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleCopyBackupCode(code, index)}
                  >
                    {copiedIndex === index ? (
                      <Check className="size-4 text-green-600" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button onClick={handleContinueFromBackup} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                Continue
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
