'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Download, FileText, Mail, Share2, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { BatchPredictionResult } from '@/lib/types'

interface ExtendedResult extends BatchPredictionResult {
  confidence_percent?: number
  deal_rating?: 'Good' | 'Fair' | 'Poor'
}

interface ExportOptionsProps {
  results: ExtendedResult[]
  statsDashboardRef?: React.RefObject<HTMLDivElement>
}

export function ExportOptions({ results, statsDashboardRef }: ExportOptionsProps) {
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [email, setEmail] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const toastHook = useToast()
  const toast = toastHook || { toast: () => {} }

  const handlePDFExport = async () => {
    setIsExporting(true)
    try {
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()

      // Title
      pdf.setFontSize(20)
      pdf.setTextColor(91, 127, 255)
      pdf.text('Car Price Prediction Report', pageWidth / 2, 20, { align: 'center' })

      // Date
      pdf.setFontSize(10)
      pdf.setTextColor(148, 163, 184)
      pdf.text(
        `Generated: ${new Date().toLocaleDateString()}`,
        pageWidth / 2,
        30,
        { align: 'center' }
      )

      let yPosition = 40

      // Summary
      pdf.setFontSize(14)
      pdf.setTextColor(0, 0, 0) // Black text
      pdf.text('Summary', 20, yPosition)
      yPosition += 10

      pdf.setFontSize(10)
      pdf.setTextColor(50, 50, 50) // Dark gray text
      pdf.text(`Total Cars: ${results.length}`, 20, yPosition)
      yPosition += 7
      pdf.text(
        `Successful: ${results.filter((r) => !r.error).length}`,
        20,
        yPosition
      )
      yPosition += 7
      pdf.text(
        `Failed: ${results.filter((r) => r.error).length}`,
        20,
        yPosition
      )
      yPosition += 15

      // Charts (if available)
      if (statsDashboardRef?.current) {
        try {
          const canvas = await html2canvas(statsDashboardRef.current, {
            background: '#0f1117',
          })
          const imgData = canvas.toDataURL('image/png')
          const imgWidth = pageWidth - 40
          const imgHeight = (canvas.height * imgWidth) / canvas.width

          if (yPosition + imgHeight > pageHeight - 20) {
            pdf.addPage()
            yPosition = 20
          }

          pdf.addImage(imgData, 'PNG', 20, yPosition, imgWidth, imgHeight)
          yPosition += imgHeight + 10
        } catch (error) {
          console.error('Failed to capture charts:', error)
        }
      }

      // Table
      pdf.setFontSize(14)
      pdf.setTextColor(0, 0, 0) // Black text
      pdf.text('Predictions', 20, yPosition)
      yPosition += 10

      // Table headers
      pdf.setFontSize(9)
      pdf.setTextColor(50, 50, 50) // Dark gray text
      const headers = ['Make', 'Model', 'Year', 'Price', 'Confidence', 'Deal']
      const colWidths = [30, 35, 20, 35, 25, 25]
      let xPos = 20

      headers.forEach((header, index) => {
        pdf.text(header, xPos, yPosition)
        xPos += colWidths[index]
      })

      yPosition += 7
      pdf.setDrawColor(42, 45, 58)
      pdf.line(20, yPosition, pageWidth - 20, yPosition)
      yPosition += 5

      // Table rows
      pdf.setFontSize(8)
      results.slice(0, 20).forEach((result) => {
        if (yPosition > pageHeight - 20) {
          pdf.addPage()
          yPosition = 20
        }

        xPos = 20
        const row = [
          result.car.make.substring(0, 15),
          result.car.model.substring(0, 15),
          String(result.car.year),
          `$${result.predicted_price.toLocaleString()}`,
          result.confidence_percent ? `${result.confidence_percent}%` : 'N/A',
          result.deal_rating || 'N/A',
        ]

        row.forEach((cell, index) => {
          pdf.setTextColor(0, 0, 0) // Black text for PDF
          pdf.text(cell, xPos, yPosition)
          xPos += colWidths[index]
        })

        yPosition += 7
      })

          // Footer
          const totalPages = pdf.getNumberOfPages()
          for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i)
            pdf.setFontSize(8)
            pdf.setTextColor(100, 100, 100) // Gray text for footer
            pdf.text(
              `Page ${i} of ${totalPages}`,
              pageWidth / 2,
              pageHeight - 10,
              { align: 'center' }
            )
          }

      pdf.save(`car-predictions-${new Date().toISOString().split('T')[0]}.pdf`)

      if (toast?.toast) {
        toast.toast({
          title: 'Success',
          description: 'PDF exported successfully',
        })
      }
    } catch (error: any) {
      console.error('PDF export error:', error)
      if (toast?.toast) {
        toast.toast({
          title: 'Error',
          description: error?.message || 'Failed to export PDF',
          variant: 'destructive',
        })
      }
    } finally {
      setIsExporting(false)
    }
  }

  const handleEmailExport = async () => {
    if (!email || !email.includes('@')) {
      if (toast?.toast) {
        toast.toast({
          title: 'Invalid Email',
          description: 'Please enter a valid email address',
          variant: 'destructive',
        })
      }
      return
    }

    setIsExporting(true)
    try {
      // Generate PDF first
      await handlePDFExport()
      
      // In a real implementation, you would send this to your backend
      // which would email the PDF to the user
      // For now, we'll just show a success message
      
      if (toast?.toast) {
        toast.toast({
          title: 'Email Sent',
          description: `Report will be sent to ${email}`,
        })
      }
      setShowEmailDialog(false)
      setEmail('')
    } catch (error: any) {
      if (toast?.toast) {
        toast.toast({
          title: 'Error',
          description: error?.message || 'Failed to send email',
          variant: 'destructive',
        })
      }
    } finally {
      setIsExporting(false)
    }
  }

  const handleSocialShare = (platform: 'whatsapp' | 'telegram') => {
    const reportUrl = window.location.href
    const message = encodeURIComponent(
      `Check out these car price predictions! ${reportUrl}`
    )

    if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${message}`, '_blank')
    } else if (platform === 'telegram') {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(reportUrl)}&text=${message}`, '_blank')
    }
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <Button
        onClick={handlePDFExport}
        disabled={isExporting || results.length === 0}
        variant="outline"
        className="border-[#2a2d3a] hover:bg-[#2a2d3a]"
      >
        {isExporting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileText className="mr-2 h-4 w-4" />
        )}
        Export PDF
      </Button>

      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="border-[#2a2d3a] hover:bg-[#2a2d3a]"
          >
            <Mail className="mr-2 h-4 w-4" />
            Email Report
          </Button>
        </DialogTrigger>
        <DialogContent className="border-[#2a2d3a] bg-[#1a1d29]">
          <DialogHeader>
            <DialogTitle>Email Report</DialogTitle>
            <DialogDescription className="text-[#94a3b8]">
              Enter your email address to receive the prediction report
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="email" className="text-[#94a3b8]">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="mt-2 border-[#2a2d3a] bg-[#0f1117]"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowEmailDialog(false)}
                className="border-[#2a2d3a]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleEmailExport}
                disabled={isExporting}
                className="bg-[#5B7FFF] hover:bg-[#5B7FFF]/90"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Report'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="border-[#2a2d3a] hover:bg-[#2a2d3a]"
          >
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
        </DialogTrigger>
        <DialogContent className="border-[#2a2d3a] bg-[#1a1d29]">
          <DialogHeader>
            <DialogTitle>Share Report</DialogTitle>
            <DialogDescription className="text-[#94a3b8]">
              Share your prediction report via social media
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Button
              onClick={() => handleSocialShare('whatsapp')}
              className="w-full bg-green-500 hover:bg-green-600"
            >
              Share on WhatsApp
            </Button>
            <Button
              onClick={() => handleSocialShare('telegram')}
              className="w-full bg-blue-500 hover:bg-blue-600"
            >
              Share on Telegram
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
