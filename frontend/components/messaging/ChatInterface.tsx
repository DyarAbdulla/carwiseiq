"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiClient } from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import {
  Send, Image as ImageIcon, ChevronLeft, Star, Trash2,
  MoreVertical, Flag, Paperclip, X
} from 'lucide-react'
import { useLocale } from 'next-intl'

interface Message {
  id: number
  sender_id: number
  recipient_id: number
  content: string
  image_url: string | null
  read: boolean
  read_at: string | null
  created_at: string
  sender_email: string | null
}

interface Conversation {
  id: number
  listing_id: number
  other_user_id: number
  other_user_email: string
  last_message: string | null
  last_message_time: string | null
  unread_count: number
  is_starred: boolean
  listing: {
    id: number
    make: string
    model: string
    year: number
    price: number
    image_url: string | null
  }
}

interface ChatInterfaceProps {
  conversation: Conversation
  onBack: () => void
  onDelete: () => void
  onStar: () => void
  onMessageSent: () => void
}

const MESSAGE_TEMPLATES = [
  "Is this still available?",
  "Can I schedule a viewing?",
  "Is the price negotiable?",
  "What's the condition of the car?",
  "Can you share more photos?",
  "Where are you located?",
]

export default function ChatInterface({
  conversation,
  onBack,
  onDelete,
  onStar,
  onMessageSent
}: ChatInterfaceProps) {
  const router = useRouter()
  const locale = useLocale()
  const { user } = useAuth()
  const { toast } = useToast()

  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (conversation.listing_id > 0 && conversation.other_user_id > 0) {
      loadMessages()
      if (conversation.id > 0) {
        startPolling()
      }
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [conversation.id, conversation.listing_id, conversation.other_user_id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadMessages = async () => {
    try {
      const data = await apiClient.getMessages(
        conversation.listing_id,
        conversation.other_user_id,
        100,
        0
      )
      setMessages(data.messages || [])
      
      // Mark as read
      await apiClient.markMessagesAsRead(conversation.listing_id, conversation.other_user_id)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load messages',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const startPolling = () => {
    // Poll for new messages every 5 seconds
    pollIntervalRef.current = setInterval(async () => {
      try {
        const data = await apiClient.getMessages(
          conversation.listing_id,
          conversation.other_user_id,
          100,
          0
        )
        setMessages(data.messages || [])
        
        // Check typing indicator
        if (conversation.id > 0) {
          const typing = await apiClient.getTypingIndicator(conversation.id)
          setIsTyping(typing)
        }
      } catch (error) {
        // Ignore polling errors
      }
    }, 5000)
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !selectedImage) return
    if (!user) return

    setSending(true)
    try {
      let imageUrl = null
      if (selectedImage) {
        // Upload image first
        const formData = new FormData()
        formData.append('image', selectedImage)
        // Note: You'll need to implement image upload endpoint
        // For now, we'll skip image upload
        toast({ title: 'Image upload coming soon' })
      }

      await apiClient.sendMessage(
        conversation.listing_id,
        conversation.other_user_id,
        newMessage.trim(),
        imageUrl || undefined
      )

      setNewMessage('')
      setSelectedImage(null)
      setImagePreview(null)
      setShowTemplates(false)
      
      // Reload messages
      await loadMessages()
      onMessageSent()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive'
      })
    } finally {
      setSending(false)
    }
  }

  const handleTyping = (value: string) => {
    setNewMessage(value)
    
    // Set typing indicator
    if (conversation.id > 0 && value.trim()) {
      apiClient.setTypingIndicator(conversation.id, true)
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      
      // Stop typing after 3 seconds
      typingTimeoutRef.current = setTimeout(() => {
        apiClient.setTypingIndicator(conversation.id, false)
      }, 3000)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'Error',
          description: 'Image size must be less than 5MB',
          variant: 'destructive'
        })
        return
      }
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const formatTime = (timeString: string) => {
    const date = new Date(timeString)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const formatDate = (timeString: string) => {
    const date = new Date(timeString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) {
      return 'Today'
    } else if (days === 1) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  const handleReportMessage = async (messageId: number) => {
    try {
      await apiClient.reportMessage(messageId)
      toast({ title: 'Message reported', description: 'Thank you for reporting this message' })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to report message',
        variant: 'destructive'
      })
    }
  }

  const handleBlockUser = async () => {
    try {
      await apiClient.blockUser(conversation.id)
      toast({ title: 'User blocked', description: 'This user has been blocked' })
      onBack()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to block user',
        variant: 'destructive'
      })
    }
  }

  // Load listing details if not available
  useEffect(() => {
    if ((!conversation.listing.make || !conversation.other_user_email) && conversation.listing_id > 0) {
      Promise.all([
        apiClient.getListing(conversation.listing_id).catch(() => null),
        conversation.other_user_id > 0 ? Promise.resolve({ id: conversation.other_user_id }) : Promise.resolve(null)
      ]).then(([listing]) => {
        if (listing) {
          // Listing details will be shown from the loaded data
        }
      }).catch(() => {
        // Ignore errors
      })
    }
  }, [conversation.listing_id, conversation.other_user_id])

  return (
    <Card className="bg-gray-800 border-gray-700 h-full flex flex-col">
      {/* Header */}
      <CardHeader className="border-b border-gray-700 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="lg:hidden text-gray-300"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            {conversation.listing.image_url && (
              <img
                src={conversation.listing.image_url}
                alt={`${conversation.listing.make} ${conversation.listing.model}`}
                className="w-10 h-10 rounded object-cover"
              />
            )}
            <div>
              <CardTitle className="text-white text-lg">
                {conversation.listing.make} {conversation.listing.model} {conversation.listing.year}
              </CardTitle>
              <p className="text-gray-400 text-sm">
                ${conversation.listing.price?.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onStar}
              className={`text-gray-300 ${conversation.is_starred ? 'text-yellow-400' : ''}`}
            >
              <Star className={`h-5 w-5 ${conversation.is_starred ? 'fill-current' : ''}`} />
            </Button>
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMenu(!showMenu)}
                className="text-gray-300"
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-2 bg-gray-700 rounded-lg shadow-lg z-10 min-w-[200px]">
                  <button
                    onClick={() => {
                      router.push(`/${locale}/buy-sell/${conversation.listing_id}`)
                      setShowMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-600 rounded-t-lg"
                  >
                    View Listing
                  </button>
                  <button
                    onClick={() => {
                      handleBlockUser()
                      setShowMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-600"
                  >
                    Block User
                  </button>
                  <button
                    onClick={() => {
                      onDelete()
                      setShowMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-red-400 hover:bg-gray-600 rounded-b-lg"
                  >
                    Delete Conversation
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Messages */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-center text-gray-400 py-8">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p>No messages yet</p>
            <p className="text-sm mt-2">Start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const isOwn = message.sender_id === user?.id
              const showDate = index === 0 || 
                new Date(message.created_at).toDateString() !== 
                new Date(messages[index - 1].created_at).toDateString()
              
              return (
                <div key={message.id}>
                  {showDate && (
                    <div className="text-center text-gray-500 text-xs my-4">
                      {formatDate(message.created_at)}
                    </div>
                  )}
                  <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
                      <div
                        className={`rounded-lg px-4 py-2 ${
                          isOwn
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-100'
                        }`}
                      >
                        {message.image_url && (
                          <img
                            src={message.image_url}
                            alt="Message attachment"
                            className="max-w-full rounded mb-2"
                          />
                        )}
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                        <div className={`flex items-center gap-2 mt-1 text-xs ${
                          isOwn ? 'text-blue-100' : 'text-gray-400'
                        }`}>
                          <span>{formatTime(message.created_at)}</span>
                          {isOwn && message.read && (
                            <span className="text-blue-300">✓✓</span>
                          )}
                          {isOwn && !message.read && (
                            <span>✓</span>
                          )}
                        </div>
                      </div>
                      {!isOwn && (
                        <div className="mt-1 text-xs text-gray-500 px-1">
                          {message.sender_email || 'Unknown'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-700 rounded-lg px-4 py-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </CardContent>

      {/* Image Preview */}
      {imagePreview && (
        <div className="px-4 pb-2">
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="max-w-xs rounded" />
            <button
              onClick={() => {
                setSelectedImage(null)
                setImagePreview(null)
              }}
              className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Message Templates */}
      {showTemplates && (
        <div className="px-4 pb-2">
          <div className="bg-gray-700 rounded-lg p-2">
            <p className="text-gray-400 text-xs mb-2">Quick messages:</p>
            <div className="flex flex-wrap gap-2">
              {MESSAGE_TEMPLATES.map((template, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setNewMessage(template)
                    setShowTemplates(false)
                  }}
                  className="text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 px-3 py-1 rounded"
                >
                  {template}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <CardContent className="border-t border-gray-700 pt-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              value={newMessage}
              onChange={(e) => handleTyping(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="bg-gray-700 border-gray-600 text-white pr-20"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
                id="image-upload"
              />
              <label htmlFor="image-upload">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-gray-300"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowTemplates(!showTemplates)}
                className="text-gray-400 hover:text-gray-300"
              >
                💬
              </Button>
            </div>
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={(!newMessage.trim() && !selectedImage) || sending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
