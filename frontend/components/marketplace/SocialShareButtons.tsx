"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  Share2, MessageCircle, Facebook, Twitter, Linkedin, 
  Mail, Copy, QrCode, X
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
// QR Code generation - using dynamic import

interface SocialShareButtonsProps {
  listing: {
    id: number
    make: string
    model: string
    year: number
    price: number
  }
  url: string
}

export function SocialShareButtons({ listing, url }: SocialShareButtonsProps) {
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const toastHook = useToast()
  const toast = toastHook || { toast: () => {} }

  const shareText = `Check out this ${listing.year} ${listing.make} ${listing.model} for ${listing.price.toLocaleString()}!`

  const handleShare = async (platform: string) => {
    const encodedUrl = encodeURIComponent(url)
    const encodedText = encodeURIComponent(shareText)

    const shareUrls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      email: `mailto:?subject=${encodeURIComponent(`${listing.year} ${listing.make} ${listing.model}`)}&body=${encodedText}%20${encodedUrl}`,
    }

    const shareUrl = shareUrls[platform]
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400')
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      if (toast?.toast) {
        toast.toast({
          title: 'Link copied',
          description: 'Listing link copied to clipboard',
        })
      }
      setShareDialogOpen(false)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleQRCode = async () => {
    try {
      // Dynamically import qrcode library
      const QRCode = (await import('qrcode')).default
      const qr = await QRCode.toDataURL(url, { width: 300 })
      setQrCodeUrl(qr)
    } catch (error) {
      console.error('Error generating QR code:', error)
      // Fallback: use online QR code service
      setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`)
    }
  }

  return (
    <>
      <Button
        onClick={() => setShareDialogOpen(true)}
        variant="outline"
        className="backdrop-blur-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
      >
        <Share2 className="h-4 w-4 mr-2" />
        Share
      </Button>

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="bg-[#1a1d29] border-[#2a2d3a] text-white">
          <DialogHeader>
            <DialogTitle>Share Listing</DialogTitle>
            <DialogDescription className="text-[#94a3b8]">
              Share this {listing.year} {listing.make} {listing.model}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <Button
              onClick={() => handleShare('whatsapp')}
              variant="outline"
              className="border-[#2a2d3a] bg-[#1a1d29] hover:bg-[#2a2d3a] text-white justify-start"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              WhatsApp
            </Button>

            <Button
              onClick={() => handleShare('facebook')}
              variant="outline"
              className="border-[#2a2d3a] bg-[#1a1d29] hover:bg-[#2a2d3a] text-white justify-start"
            >
              <Facebook className="h-4 w-4 mr-2" />
              Facebook
            </Button>

            <Button
              onClick={() => handleShare('twitter')}
              variant="outline"
              className="border-[#2a2d3a] bg-[#1a1d29] hover:bg-[#2a2d3a] text-white justify-start"
            >
              <Twitter className="h-4 w-4 mr-2" />
              Twitter
            </Button>

            <Button
              onClick={() => handleShare('linkedin')}
              variant="outline"
              className="border-[#2a2d3a] bg-[#1a1d29] hover:bg-[#2a2d3a] text-white justify-start"
            >
              <Linkedin className="h-4 w-4 mr-2" />
              LinkedIn
            </Button>

            <Button
              onClick={() => handleShare('email')}
              variant="outline"
              className="border-[#2a2d3a] bg-[#1a1d29] hover:bg-[#2a2d3a] text-white justify-start"
            >
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>

            <Button
              onClick={handleCopyLink}
              variant="outline"
              className="border-[#2a2d3a] bg-[#1a1d29] hover:bg-[#2a2d3a] text-white justify-start"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </Button>

            <Button
              onClick={handleQRCode}
              variant="outline"
              className="border-[#2a2d3a] bg-[#1a1d29] hover:bg-[#2a2d3a] text-white justify-start col-span-2"
            >
              <QrCode className="h-4 w-4 mr-2" />
              Generate QR Code
            </Button>
          </div>

          {qrCodeUrl && (
            <div className="mt-4 p-4 bg-[#2a2d3a] rounded-lg text-center">
              <img src={qrCodeUrl} alt="QR Code" className="mx-auto mb-2" />
              <p className="text-sm text-[#94a3b8]">Scan to view listing</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
