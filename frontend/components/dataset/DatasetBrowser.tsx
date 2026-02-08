"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, Loader2, Image as ImageIcon, Grid3x3, List } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { apiClient } from '@/lib/api'

export interface DatasetImage {
  id: number
  filename: string
  filepath: string
  folder_path: string
  file_size: number
  width: number
  height: number
  thumbnail_path: string | null
}

interface DatasetResponse {
  images: DatasetImage[]
  total: number
  page: number
  limit: number
  total_pages: number
}

interface DatasetBrowserProps {
  onSelectImage: (image: DatasetImage) => void
  selectedImageId?: number
}

export function DatasetBrowser({ onSelectImage, selectedImageId }: DatasetBrowserProps) {
  const [images, setImages] = useState<DatasetImage[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [status, setStatus] = useState<{ total_images: number; last_scan_time: string | null } | null>(null)

  const limit = 100

  // Fetch images
  const fetchImages = useCallback(async (pageNum: number, search?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString(),
      })

      if (search) {
        params.append('search', search)
      }

      const response = await apiClient.get<DatasetResponse>(`/api/dataset/images?${params}`)
      setImages(response.data.images)
      setTotalPages(response.data.total_pages)
      setTotal(response.data.total)
    } catch (error) {
      console.error('Error fetching images:', error)
    } finally {
      setLoading(false)
    }
  }, [limit])

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/dataset/status')
      setStatus(response.data)
    } catch (error) {
      console.error('Error fetching status:', error)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchStatus()
    fetchImages(1)
  }, [fetchImages, fetchStatus])

  // Handle search
  const handleSearch = useCallback(() => {
    setSearchQuery(searchInput)
    setPage(1)
    fetchImages(1, searchInput || undefined)
  }, [searchInput, fetchImages])

  // Handle page change
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
    fetchImages(newPage, searchQuery || undefined)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [fetchImages, searchQuery])

  // Get image URL
  const getImageUrl = useCallback((image: DatasetImage) => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'
    if (image.thumbnail_path) {
      return `${apiBaseUrl}/api/dataset/images/${image.id}/thumbnail`
    }
    return `${apiBaseUrl}/api/dataset/images/${image.id}/file`
  }, [])

  // Format file size
  const formatFileSize = useCallback((bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }, [])

  // Pagination buttons
  const paginationButtons = useMemo(() => {
    const buttons = []
    const maxButtons = 7
    let startPage = Math.max(1, page - Math.floor(maxButtons / 2))
    let endPage = Math.min(totalPages, startPage + maxButtons - 1)

    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1)
    }

    if (startPage > 1) {
      buttons.push(
        <button
          key="first"
          onClick={() => handlePageChange(1)}
          className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 text-sm"
        >
          1
        </button>
      )
      if (startPage > 2) {
        buttons.push(<span key="ellipsis1" className="text-white/40">...</span>)
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`px-3 py-2 rounded-lg text-sm ${
            i === page
              ? 'bg-[#5B7FFF] text-white'
              : 'bg-white/5 hover:bg-white/10 text-white/80'
          }`}
        >
          {i}
        </button>
      )
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        buttons.push(<span key="ellipsis2" className="text-white/40">...</span>)
      }
      buttons.push(
        <button
          key="last"
          onClick={() => handlePageChange(totalPages)}
          className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 text-sm"
        >
          {totalPages}
        </button>
      )
    }

    return buttons
  }, [page, totalPages, handlePageChange])

  return (
    <div className="space-y-4">
      {/* Header with search and controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40 w-4 h-4" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by filename or folder..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#5B7FFF]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg ${
              viewMode === 'grid' ? 'bg-[#5B7FFF] text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg ${
              viewMode === 'list' ? 'bg-[#5B7FFF] text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status info */}
      {status && (
        <div className="text-sm text-white/60">
          {status.total_images.toLocaleString()} images indexed
          {status.last_scan_time && (
            <span className="ml-2">• Last scan: {new Date(status.last_scan_time).toLocaleDateString()}</span>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#5B7FFF] animate-spin" />
        </div>
      )}

      {/* Image grid/list */}
      {!loading && images.length > 0 && (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4'
              : 'space-y-2'
          }
        >
          <AnimatePresence mode="popLayout">
            {images.map((image) => (
              <motion.div
                key={image.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`relative group cursor-pointer ${
                  viewMode === 'grid'
                    ? 'aspect-square'
                    : 'flex items-center gap-4 p-2 rounded-lg hover:bg-white/5'
                } ${
                  selectedImageId === image.id ? 'ring-2 ring-[#5B7FFF]' : ''
                }`}
                onClick={() => onSelectImage(image)}
              >
                {viewMode === 'grid' ? (
                  <>
                    <div className="relative w-full h-full rounded-lg overflow-hidden bg-white/5 border border-white/10">
                      <Image
                        src={getImageUrl(image)}
                        alt={image.filename}
                        fill
                        className="object-cover"
                        loading="lazy"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-xs text-white truncate">{image.filename}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                      <Image
                        src={getImageUrl(image)}
                        alt={image.filename}
                        fill
                        className="object-cover"
                        loading="lazy"
                        unoptimized
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{image.filename}</p>
                      <p className="text-xs text-white/60 truncate">{image.folder_path}</p>
                      <p className="text-xs text-white/40 mt-1">
                        {image.width}×{image.height} • {formatFileSize(image.file_size)}
                      </p>
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Empty state */}
      {!loading && images.length === 0 && (
        <div className="text-center py-12">
          <ImageIcon className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <p className="text-white/60">No images found</p>
          {searchQuery && (
            <p className="text-sm text-white/40 mt-2">Try a different search term</p>
          )}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
            className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          {paginationButtons}
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPages}
            className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {/* Page info */}
      {!loading && total > 0 && (
        <div className="text-center text-sm text-white/60">
          Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total.toLocaleString()} images
        </div>
      )}
    </div>
  )
}
