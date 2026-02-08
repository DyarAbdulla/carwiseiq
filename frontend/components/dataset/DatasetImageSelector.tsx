"use client"

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DatasetBrowser } from './DatasetBrowser'
import { Upload, Database } from 'lucide-react'
import type { DatasetImage } from './DatasetBrowser'

interface DatasetImageSelectorProps {
  onImageSelect: (imageFile: File, previewUrl: string) => void
  currentImages: string[]
  maxImages?: number
  fileInputRef?: React.RefObject<HTMLInputElement>
  onFileUpload?: (files: FileList | null) => void
}

export function DatasetImageSelector({
  onImageSelect,
  currentImages,
  maxImages = 10,
  fileInputRef,
  onFileUpload
}: DatasetImageSelectorProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'dataset'>('upload')

  const handleDatasetImageSelect = async (image: DatasetImage) => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'
      const imageUrl = `${apiBaseUrl}/api/dataset/images/${image.id}/file`

      // Fetch image as blob
      const response = await fetch(imageUrl)
      if (!response.ok) throw new Error('Failed to fetch image')

      const blob = await response.blob()
      const file = new File([blob], image.filename, { type: blob.type })

      // Create preview URL
      const previewUrl = URL.createObjectURL(blob)

      // Check if we've reached max images
      if (currentImages.length >= maxImages) {
        // Replace the first image if at max
        onImageSelect(file, previewUrl)
      } else {
        onImageSelect(file, previewUrl)
      }

      // Switch to upload tab to show the selected image
      setActiveTab('upload')
    } catch (error) {
      console.error('Error loading dataset image:', error)
    }
  }

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upload' | 'dataset')} className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-4">
        <TabsTrigger value="upload" className="flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Upload Image
        </TabsTrigger>
        <TabsTrigger value="dataset" className="flex items-center gap-2">
          <Database className="w-4 h-4" />
          Choose from Dataset
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upload" className="mt-0">
        {/* Upload tab - file input handled by parent */}
        <div className="text-sm text-white/60 text-center py-4">
          {fileInputRef ? (
            <div>
              <p className="mb-2">Click the upload area below to select images</p>
              <p className="text-xs text-white/40">Or use the drag & drop area</p>
            </div>
          ) : (
            <p>File upload will be available here</p>
          )}
        </div>
      </TabsContent>

      <TabsContent value="dataset" className="mt-0">
        <div className="max-h-[600px] overflow-y-auto">
          <DatasetBrowser
            onSelectImage={handleDatasetImageSelect}
          />
        </div>
      </TabsContent>
    </Tabs>
  )
}
