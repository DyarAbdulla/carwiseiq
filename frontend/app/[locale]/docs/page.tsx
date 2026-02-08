"use client"

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import {
  ExternalLink, Code, Book, Zap, Copy, Check, ChevronDown, ChevronUp,
  Search, Play, Loader2, AlertCircle, CheckCircle2, Clock, Shield,
  Activity, Database, Terminal, Globe
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/hooks/use-toast'

// Copy button component with success animation
const CopyButton = ({ text, className = '' }: { text: string; className?: string }) => {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleCopy = async () => {
    try {
      if (typeof window === 'undefined' || !navigator?.clipboard) {
        throw new Error('Clipboard API not available')
      }
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (toast && typeof toast === 'function') {
        toast({
          title: 'Copied!',
          description: 'Code copied to clipboard',
        })
      }
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Copy error:', error)
      if (toast && typeof toast === 'function') {
        toast({
          title: 'Failed to copy',
          description: 'Please try again',
          variant: 'destructive',
        })
      }
    }
  }

  return (
    <motion.button
      onClick={handleCopy}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className={`p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors ${className}`}
    >
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.div
            key="check"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            transition={{ duration: 0.2 }}
          >
            <Check className="h-4 w-4 text-green-400" />
          </motion.div>
        ) : (
          <motion.div
            key="copy"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
          >
            <Copy className="h-4 w-4 text-white/70" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

// Syntax highlighting component (simplified - would use a library like Prism.js in production)
const CodeBlock = ({ code, language, showLineNumbers = true }: { code: string; language: string; showLineNumbers?: boolean }) => {
  const lines = code.split('\n')

  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-10">
        <CopyButton text={code} />
      </div>
      <pre className="p-4 pr-12 bg-[#0f1117] rounded-lg border border-white/10 text-sm font-mono overflow-x-auto">
        <code className={`language-${language}`}>
          {lines.map((line, idx) => (
            <div key={idx} className="flex">
              {showLineNumbers && (
                <span className="text-white/30 mr-4 select-none w-8 text-right">{idx + 1}</span>
              )}
              <span className="text-white/90">{line || ' '}</span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  )
}

export default function DocsPage() {
  const t = useTranslations('docs')
  const tCommon = useTranslations('common')
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [openEndpoints, setOpenEndpoints] = useState<Set<string>>(new Set(['health']))
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [testResponse, setTestResponse] = useState<any>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [testEndpoint, setTestEndpoint] = useState('')
  const [testMethod, setTestMethod] = useState('GET')
  const [testBody, setTestBody] = useState('')
  const [activeTab, setActiveTab] = useState('javascript')
  const sidebarRef = useRef<HTMLDivElement>(null)

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'
  const apiVersion = '1.0.0'

  // Check API status on mount
  useEffect(() => {
    checkApiStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkApiStatus = async () => {
    setApiStatus('checking')
    try {
      const response = await fetch(`${apiBaseUrl}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      if (response.ok) {
        setApiStatus('online')
      } else {
        setApiStatus('offline')
      }
    } catch (error) {
      setApiStatus('offline')
    }
  }

  const toggleEndpoint = (endpoint: string) => {
    const newOpen = new Set(openEndpoints)
    if (newOpen.has(endpoint)) {
      newOpen.delete(endpoint)
    } else {
      newOpen.add(endpoint)
    }
    setOpenEndpoints(newOpen)
  }

  const handleTestApi = async () => {
    if (!testEndpoint) {
      toast({
        title: 'Error',
        description: 'Please enter an endpoint',
        variant: 'destructive',
      })
      return
    }

    setTestLoading(true)
    setTestResponse(null)

    try {
      const url = testEndpoint.startsWith('http') ? testEndpoint : `${apiBaseUrl}${testEndpoint}`
      const options: RequestInit = {
        method: testMethod,
        headers: {
          'Content-Type': 'application/json',
        },
      }

      if (testMethod !== 'GET' && testBody) {
        try {
          options.body = JSON.stringify(JSON.parse(testBody))
        } catch (e) {
          toast({
            title: 'Invalid JSON',
            description: 'Please check your request body',
            variant: 'destructive',
          })
          setTestLoading(false)
          return
        }
      }

      const startTime = Date.now()
      const response = await fetch(url, options)
      const endTime = Date.now()
      const data = await response.json().catch(() => ({ error: 'Invalid JSON response' }))

      setTestResponse({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data,
        timing: endTime - startTime,
      })
    } catch (error: any) {
      setTestResponse({
        error: error.message || 'Request failed',
      })
    } finally {
      setTestLoading(false)
    }
  }

  const endpoints = [
    {
      id: 'health',
      method: 'GET',
      path: '/api/health',
      description: 'Check API health status and verify the service is running',
      parameters: [],
      response: {
        status: 200,
        body: {
          status: 'healthy',
          message: 'API is running',
          model_loaded: true,
          timestamp: '2025-01-01T00:00:00Z',
        },
      },
    },
    {
      id: 'predict',
      method: 'POST',
      path: '/api/predict',
      description: 'Predict car price from features using machine learning model',
      parameters: [
        { name: 'features', type: 'object', required: true, description: 'Car features object' },
        { name: 'features.year', type: 'number', required: true, description: 'Year of manufacture' },
        { name: 'features.mileage', type: 'number', required: true, description: 'Mileage in kilometers' },
        { name: 'features.engine_size', type: 'number', required: true, description: 'Engine size in liters' },
        { name: 'features.cylinders', type: 'number', required: true, description: 'Number of cylinders' },
        { name: 'features.make', type: 'string', required: true, description: 'Car make (e.g., Toyota)' },
        { name: 'features.model', type: 'string', required: true, description: 'Car model (e.g., Camry)' },
        { name: 'features.condition', type: 'string', required: true, description: 'Condition (New, Good, Fair, Poor)' },
        { name: 'features.fuel_type', type: 'string', required: true, description: 'Fuel type (Gasoline, Diesel, Hybrid, etc.)' },
        { name: 'features.location', type: 'string', required: true, description: 'Location (e.g., California)' },
      ],
      body: {
        features: {
          year: 2020,
          mileage: 30000,
          engine_size: 2.5,
          cylinders: 4,
          make: 'Toyota',
          model: 'Camry',
          condition: 'Good',
          fuel_type: 'Gasoline',
          location: 'California',
        },
      },
      response: {
        status: 200,
        body: {
          predicted_price: 18750.50,
          confidence_interval: {
            lower: 15000,
            upper: 22500,
          },
          confidence_range: 85,
        },
      },
    },
    {
      id: 'predict-batch',
      method: 'POST',
      path: '/api/predict/batch',
      description: 'Predict prices for multiple cars in a single request',
      parameters: [
        { name: 'cars', type: 'array', required: true, description: 'Array of car feature objects' },
      ],
      body: {
        cars: [
          {
            year: 2020,
            mileage: 30000,
            engine_size: 2.5,
            cylinders: 4,
            make: 'Toyota',
            model: 'Camry',
            condition: 'Good',
            fuel_type: 'Gasoline',
            location: 'California',
          },
        ],
      },
      response: {
        status: 200,
        body: {
          predictions: [
            {
              car: { /* car features */ },
              predicted_price: 18750.50,
              confidence_interval: { lower: 15000, upper: 22500 },
            },
          ],
          total: 1,
          successful: 1,
          failed: 0,
        },
      },
    },
    {
      id: 'makes',
      method: 'GET',
      path: '/api/cars/makes',
      description: 'Get list of all available car makes in the dataset',
      parameters: [],
      response: {
        status: 200,
        body: ['Toyota', 'Honda', 'Ford', 'BMW', 'Mercedes-Benz', '...'],
      },
    },
    {
      id: 'models',
      method: 'GET',
      path: '/api/cars/models/{make}',
      description: 'Get list of models for a specific car make',
      parameters: [
        { name: 'make', type: 'string', required: true, description: 'Car make (path parameter)', in: 'path' },
      ],
      response: {
        status: 200,
        body: ['Camry', 'Corolla', 'RAV4', 'Highlander', '...'],
      },
    },
    {
      id: 'budget',
      method: 'GET',
      path: '/api/budget/search',
      description: 'Search for cars within a budget range',
      parameters: [
        { name: 'min_price', type: 'number', required: false, description: 'Minimum price' },
        { name: 'max_price', type: 'number', required: false, description: 'Maximum price' },
        { name: 'make', type: 'string', required: false, description: 'Filter by make' },
        { name: 'min_year', type: 'number', required: false, description: 'Minimum year' },
        { name: 'max_year', type: 'number', required: false, description: 'Maximum year' },
        { name: 'page', type: 'number', required: false, description: 'Page number (default: 1)' },
        { name: 'page_size', type: 'number', required: false, description: 'Items per page (default: 20)' },
      ],
      response: {
        status: 200,
        body: {
          total: 1000,
          page: 1,
          page_size: 20,
          results: [/* car results */],
        },
      },
    },
    {
      id: 'stats',
      method: 'GET',
      path: '/api/stats/summary',
      description: 'Get dataset statistics summary',
      parameters: [],
      response: {
        status: 200,
        body: {
          top_makes: [{ make: 'Toyota', count: 12000 }],
          fuel_type_distribution: [{ fuel_type: 'Gasoline', count: 50000, percentage: 80 }],
          price_trends_by_year: [{ year: 2020, average_price: 18750 }],
          price_by_condition: [{ condition: 'Good', average_price: 18000 }],
        },
      },
    },
  ]

  const filteredEndpoints = endpoints.filter(endpoint =>
    endpoint.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
    endpoint.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    endpoint.method.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'POST':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'PUT':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case 'DELETE':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-400'
    if (status >= 400 && status < 500) return 'text-orange-400'
    if (status >= 500) return 'text-red-400'
    return 'text-white'
  }

  const codeExamples = {
    javascript: `const response = await fetch('${apiBaseUrl}/api/predict', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    features: {
      year: 2020,
      mileage: 30000,
      engine_size: 2.5,
      cylinders: 4,
      make: 'Toyota',
      model: 'Camry',
      condition: 'Good',
      fuel_type: 'Gasoline',
      location: 'California',
    },
  }),
});

const data = await response.json();
console.log('Predicted price:', data.predicted_price);`,
    python: `import requests

response = requests.post(
    '${apiBaseUrl}/api/predict',
    json={
        'features': {
            'year': 2020,
            'mileage': 30000,
            'engine_size': 2.5,
            'cylinders': 4,
            'make': 'Toyota',
            'model': 'Camry',
            'condition': 'Good',
            'fuel_type': 'Gasoline',
            'location': 'California',
        }
    }
)

data = response.json()
print(f"Predicted price: ${'{'}data['predicted_price']${'}'}")`,
    curl: `curl -X POST "${apiBaseUrl}/api/predict" \\
  -H "Content-Type: application/json" \\
  -d '{
    "features": {
      "year": 2020,
      "mileage": 30000,
      "engine_size": 2.5,
      "cylinders": 4,
      "make": "Toyota",
      "model": "Camry",
      "condition": "Good",
      "fuel_type": "Gasoline",
      "location": "California"
    }
  }'`,
    go: `package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

func main() {
    url := "${apiBaseUrl}/api/predict"

    data := map[string]interface{}{
        "features": map[string]interface{}{
            "year": 2020,
            "mileage": 30000,
            "engine_size": 2.5,
            "cylinders": 4,
            "make": "Toyota",
            "model": "Camry",
            "condition": "Good",
            "fuel_type": "Gasoline",
            "location": "California",
        },
    }

    jsonData, _ := json.Marshal(data)
    req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
    req.Header.Set("Content-Type", "application/json")

    client := &http.Client{}
    resp, _ := client.Do(req)
    defer resp.Body.Close()

    var result map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&result)
    fmt.Println("Predicted price:", result["predicted_price"])
}`,
    ruby: `require 'net/http'
require 'json'

uri = URI('${apiBaseUrl}/api/predict')
http = Net::HTTP.new(uri.host, uri.port)

request = Net::HTTP::Post.new(uri.path)
request['Content-Type'] = 'application/json'
request.body = {
  features: {
    year: 2020,
    mileage: 30000,
    engine_size: 2.5,
    cylinders: 4,
    make: 'Toyota',
    model: 'Camry',
    condition: 'Good',
    fuel_type: 'Gasoline',
    location: 'California'
  }
}.to_json

response = http.request(request)
data = JSON.parse(response.body)
puts "Predicted price: #{data['predicted_price']}"`,
  }

  const responseCodes = [
    { code: 200, name: 'OK', description: 'Request succeeded', color: 'text-green-400' },
    { code: 201, name: 'Created', description: 'Resource created successfully', color: 'text-green-400' },
    { code: 400, name: 'Bad Request', description: 'Invalid request parameters', color: 'text-orange-400' },
    { code: 401, name: 'Unauthorized', description: 'Authentication required', color: 'text-orange-400' },
    { code: 403, name: 'Forbidden', description: 'Access denied', color: 'text-orange-400' },
    { code: 404, name: 'Not Found', description: 'Resource not found', color: 'text-orange-400' },
    { code: 422, name: 'Unprocessable Entity', description: 'Validation error', color: 'text-orange-400' },
    { code: 500, name: 'Internal Server Error', description: 'Server error occurred', color: 'text-red-400' },
    { code: 503, name: 'Service Unavailable', description: 'Service temporarily unavailable', color: 'text-red-400' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#1a1d29] to-[#0f1117]">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-cyan-500 py-16 md:py-24"
      >
        {/* Animated Background Icons */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute"
              initial={{ x: -100, y: Math.random() * 600 }}
              animate={{
                x: [2000, -100],
                y: [Math.random() * 600, Math.random() * 600],
              }}
              transition={{
                duration: 20 + Math.random() * 10,
                repeat: Infinity,
                ease: 'linear',
                delay: Math.random() * 5,
              }}
            >
              <Code className="h-12 w-12 text-white/10" />
            </motion.div>
          ))}
        </div>

        <div className="container relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4"
            >
              <Badge className="bg-white/20 text-white border-white/30 mb-4">
                v{apiVersion}
              </Badge>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="text-4xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-purple-100"
            >
              {t('title')}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-xl md:text-2xl text-white/90 mb-8"
            >
              {t('description')}
            </motion.p>

            {/* Search Bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="max-w-2xl mx-auto"
            >
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-white/50" />
                <Input
                  type="text"
                  placeholder="Search endpoints..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 pr-4 py-6 bg-white/10 backdrop-blur-md border-white/20 text-white placeholder:text-white/50 text-lg"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      <div className="container px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar Navigation */}
            <div className="lg:col-span-1">
              <motion.div
                ref={sidebarRef}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="sticky top-8"
              >
                <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white text-sm">Navigation</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {endpoints.map((endpoint) => (
                      <button
                        key={endpoint.id}
                        onClick={() => {
                          document.getElementById(endpoint.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          toggleEndpoint(endpoint.id)
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                      >
                        <span className={`w-2 h-2 rounded-full ${openEndpoints.has(endpoint.id) ? 'bg-[#5B7FFF]' : 'bg-white/20'}`} />
                        {endpoint.method} {endpoint.path}
                      </button>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3 space-y-6">
              {/* Quick Start Cards */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid gap-6 md:grid-cols-2"
              >
                <motion.div
                  whileHover={{ y: -5, scale: 1.02 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="border-white/10 bg-gradient-to-br from-[#5B7FFF]/20 to-[#8B5CF6]/20 backdrop-blur-xl hover:border-[#5B7FFF]/50 transition-all duration-300 hover:shadow-2xl hover:shadow-[#5B7FFF]/20 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#5B7FFF]/10 to-transparent opacity-50" />
                    <CardHeader className="relative z-10">
                      <CardTitle className="flex items-center gap-2 text-white">
                        <motion.div
                          animate={{ rotate: [0, 10, -10, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Zap className="h-5 w-5 text-[#5B7FFF]" />
                        </motion.div>
                        {t('swagger')}
                      </CardTitle>
                      <CardDescription className="text-white/70">
                        Interactive API documentation with live testing
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="relative z-10">
                      <Button
                        asChild
                        className="w-full bg-gradient-to-r from-[#5B7FFF] to-[#8B5CF6] hover:from-[#5B7FFF]/90 hover:to-[#8B5CF6]/90 text-white"
                      >
                        <a
                          href={`${apiBaseUrl}/docs`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open Swagger UI
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  whileHover={{ y: -5, scale: 1.02 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="border-white/10 bg-gradient-to-br from-[#8B5CF6]/20 to-[#EC4899]/20 backdrop-blur-xl hover:border-[#8B5CF6]/50 transition-all duration-300 hover:shadow-2xl hover:shadow-[#8B5CF6]/20 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#8B5CF6]/10 to-transparent opacity-50" />
                    <CardHeader className="relative z-10">
                      <CardTitle className="flex items-center gap-2 text-white">
                        <Book className="h-5 w-5 text-[#8B5CF6]" />
                        API Reference
                      </CardTitle>
                      <CardDescription className="text-white/70">
                        Complete API endpoint documentation
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="relative z-10">
                      <Button
                        asChild
                        className="w-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] hover:from-[#8B5CF6]/90 hover:to-[#EC4899]/90 text-white"
                      >
                        <a
                          href={`${apiBaseUrl}/redoc`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open ReDoc
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>

              {/* Base URL Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                id="base-url"
              >
                <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Globe className="h-5 w-5 text-[#5B7FFF]" />
                      {t('baseUrl')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="relative group">
                      <code className="block p-4 pr-20 bg-[#0f1117] rounded-lg border border-white/10 text-[#5B7FFF] font-mono text-sm break-all">
                        {apiBaseUrl}
                      </code>
                      <div className="absolute top-2 right-2">
                        <CopyButton text={apiBaseUrl} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={checkApiStatus}
                        variant="outline"
                        className="border-white/20 bg-white/5 hover:bg-white/10 text-white"
                      >
                        <Activity className={`h-4 w-4 mr-2 ${apiStatus === 'checking' ? 'animate-spin' : ''}`} />
                        Test Connection
                      </Button>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          apiStatus === 'online' ? 'bg-green-400 animate-pulse' :
                          apiStatus === 'offline' ? 'bg-red-400' :
                          'bg-yellow-400'
                        }`} />
                        <span className="text-white/70 text-sm">
                          {apiStatus === 'online' ? 'Online' :
                           apiStatus === 'offline' ? 'Offline' :
                           'Checking...'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Authentication Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Shield className="h-5 w-5 text-[#10B981]" />
                      Authentication
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-white/80">
                      Currently, the API does not require authentication for development use.
                      All endpoints are publicly accessible. In production, authentication may be required.
                    </p>
                    <div className="p-4 bg-[#0f1117] rounded-lg border border-white/10">
                      <p className="text-white/70 text-sm mb-2">Example with Authorization Header:</p>
                      <CodeBlock code={`headers: {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer YOUR_API_KEY'
}`} language="javascript" showLineNumbers={false} />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Rate Limits Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Clock className="h-5 w-5 text-[#F59E0B]" />
                      Rate Limits
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-white/70">Requests per minute</span>
                        <span className="text-white font-semibold">Unlimited</span>
                      </div>
                      <div className="w-full h-2 bg-[#0f1117] rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-[#5B7FFF] to-[#8B5CF6]"
                          initial={{ width: 0 }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 1 }}
                        />
                      </div>
                    </div>
                    <p className="text-white/50 text-sm">
                      API is currently unlimited for development. Production limits may apply.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Interactive API Tester */}
              <motion.div
                id="api-tester"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Terminal className="h-5 w-5 text-[#EC4899]" />
                      Try the API
                    </CardTitle>
                    <CardDescription className="text-white/70">
                      Test endpoints directly from the documentation
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <label className="text-white/70 text-sm mb-2 block">Method</label>
                        <select
                          value={testMethod}
                          onChange={(e) => setTestMethod(e.target.value)}
                          className="w-full p-2 bg-[#0f1117] border border-white/10 rounded-lg text-white"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-white/70 text-sm mb-2 block">Endpoint</label>
                        <Input
                          value={testEndpoint}
                          onChange={(e) => setTestEndpoint(e.target.value)}
                          placeholder="/api/health"
                          className="bg-[#0f1117] border-white/10 text-white"
                        />
                      </div>
                    </div>
                    {testMethod !== 'GET' && (
                      <div>
                        <label className="text-white/70 text-sm mb-2 block">Request Body (JSON)</label>
                        <textarea
                          value={testBody}
                          onChange={(e) => setTestBody(e.target.value)}
                          placeholder='{"key": "value"}'
                          className="w-full p-3 bg-[#0f1117] border border-white/10 rounded-lg text-white font-mono text-sm min-h-[100px]"
                        />
                      </div>
                    )}
                    <Button
                      onClick={handleTestApi}
                      disabled={testLoading}
                      className="w-full bg-gradient-to-r from-[#5B7FFF] to-[#8B5CF6] hover:from-[#5B7FFF]/90 hover:to-[#8B5CF6]/90 text-white"
                    >
                      {testLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending Request...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Send Request
                        </>
                      )}
                    </Button>

                    {testResponse && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 p-4 bg-[#0f1117] rounded-lg border border-white/10"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white/70 text-sm">Response</span>
                          {testResponse.status && (
                            <Badge className={getStatusColor(testResponse.status)}>
                              {testResponse.status} {testResponse.statusText}
                            </Badge>
                          )}
                          {testResponse.timing && (
                            <span className="text-white/50 text-xs">{testResponse.timing}ms</span>
                          )}
                        </div>
                        <CodeBlock
                          code={JSON.stringify(testResponse.data || testResponse, null, 2)}
                          language="json"
                          showLineNumbers={false}
                        />
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Endpoints Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Code className="h-5 w-5 text-[#5B7FFF]" />
                      {t('endpoints')}
                    </CardTitle>
                    <CardDescription className="text-white/70">
                      Available API endpoints and their usage
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {filteredEndpoints.length === 0 ? (
                      <p className="text-white/50 text-center py-8">No endpoints found matching &quot;{searchQuery}&quot;</p>
                    ) : (
                      filteredEndpoints.map((endpoint, index) => (
                        <motion.div
                          key={endpoint.id}
                          id={endpoint.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <Collapsible open={openEndpoints.has(endpoint.id)} onOpenChange={() => toggleEndpoint(endpoint.id)}>
                            <CollapsibleTrigger className="w-full">
                              <Card className="border-white/10 bg-white/5 backdrop-blur-xl hover:border-[#5B7FFF]/50 transition-all">
                                <CardHeader className="flex flex-row items-center justify-between">
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <Badge className={getMethodColor(endpoint.method)}>
                                      {endpoint.method}
                                    </Badge>
                                    <code className="text-sm text-[#5B7FFF] font-mono">
                                      {endpoint.path}
                                    </code>
                                  </div>
                                  <ChevronDown className={`h-5 w-5 text-white/50 transition-transform ${openEndpoints.has(endpoint.id) ? 'rotate-180' : ''}`} />
                                </CardHeader>
                                <CardContent>
                                  <p className="text-sm text-white/80">{endpoint.description}</p>
                                </CardContent>
                              </Card>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <Card className="mt-2 border-white/10 bg-[#0f1117]">
                                <CardContent className="p-6 space-y-6">
                                  {/* Parameters */}
                                  {endpoint.parameters && endpoint.parameters.length > 0 && (
                                    <div>
                                      <h4 className="text-white font-semibold mb-3">Parameters</h4>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                          <thead>
                                            <tr className="border-b border-white/10">
                                              <th className="text-left p-2 text-white/70">Name</th>
                                              <th className="text-left p-2 text-white/70">Type</th>
                                              <th className="text-left p-2 text-white/70">Required</th>
                                              <th className="text-left p-2 text-white/70">Description</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {endpoint.parameters.map((param: any, idx: number) => (
                                              <tr key={idx} className="border-b border-white/5">
                                                <td className="p-2 text-white/90 font-mono">{param.name}</td>
                                                <td className="p-2 text-[#5B7FFF]">{param.type}</td>
                                                <td className="p-2">
                                                  {param.required ? (
                                                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Yes</Badge>
                                                  ) : (
                                                    <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">No</Badge>
                                                  )}
                                                </td>
                                                <td className="p-2 text-white/70">{param.description}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}

                                  {/* Request Body */}
                                  {endpoint.body && (
                                    <div>
                                      <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-white font-semibold">Request Body</h4>
                                        <CopyButton text={JSON.stringify(endpoint.body, null, 2)} />
                                      </div>
                                      <CodeBlock
                                        code={JSON.stringify(endpoint.body, null, 2)}
                                        language="json"
                                      />
                                    </div>
                                  )}

                                  {/* Response Example */}
                                  {endpoint.response && (
                                    <div>
                                      <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-white font-semibold">Response Example</h4>
                                        <CopyButton text={JSON.stringify(endpoint.response.body, null, 2)} />
                                      </div>
                                      <div className="mb-2">
                                        <Badge className={getStatusColor(endpoint.response.status)}>
                                          {endpoint.response.status}
                                        </Badge>
                                      </div>
                                      <CodeBlock
                                        code={JSON.stringify(endpoint.response.body, null, 2)}
                                        language="json"
                                      />
                                    </div>
                                  )}

                                  {/* Try It Button */}
                                  <Button
                                    onClick={() => {
                                      setTestEndpoint(endpoint.path)
                                      setTestMethod(endpoint.method)
                                      if (endpoint.body) {
                                        setTestBody(JSON.stringify(endpoint.body, null, 2))
                                      }
                                      setTimeout(() => {
                                        document.getElementById('api-tester')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                      }, 100)
                                    }}
                                    variant="outline"
                                    className="w-full border-[#5B7FFF]/30 bg-[#5B7FFF]/10 hover:bg-[#5B7FFF]/20 text-white"
                                  >
                                    <Play className="h-4 w-4 mr-2" />
                                    Try It
                                  </Button>
                                </CardContent>
                              </Card>
                            </CollapsibleContent>
                          </Collapsible>
                        </motion.div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Code Examples */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                id="examples"
              >
                <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white">{t('examples')}</CardTitle>
                    <CardDescription className="text-white/70">
                      Code examples in multiple programming languages
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="w-full">
                      <div className="grid w-full grid-cols-5 bg-[#0f1117] border border-white/10 rounded-t-lg overflow-hidden">
                        {Object.keys(codeExamples).map((lang) => (
                          <button
                            key={lang}
                            onClick={() => setActiveTab(lang)}
                            className={`px-4 py-2 text-sm font-medium transition-colors ${
                              activeTab === lang
                                ? 'bg-[#5B7FFF]/20 text-white border-b-2 border-[#5B7FFF]'
                                : 'text-white/70 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            {lang === 'javascript' ? 'JavaScript' : lang === 'curl' ? 'cURL' : lang.charAt(0).toUpperCase() + lang.slice(1)}
                          </button>
                        ))}
                      </div>
                      <div className="mt-4">
                        {Object.entries(codeExamples).map(([lang, code]) => (
                          <div key={lang} className={activeTab === lang ? 'block' : 'hidden'}>
                            <CodeBlock code={code} language={lang} />
                            {lang === 'javascript' && (
                              <Button
                                onClick={() => {
                                  toast({
                                    title: 'Run in Console',
                                    description: 'Open browser console and paste the code',
                                  })
                                }}
                                variant="outline"
                                className="mt-4 border-[#5B7FFF]/30 bg-[#5B7FFF]/10 hover:bg-[#5B7FFF]/20 text-white"
                              >
                                <Terminal className="h-4 w-4 mr-2" />
                                Run in Console
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Response Codes Table */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-white">HTTP Response Codes</CardTitle>
                    <CardDescription className="text-white/70">
                      Standard HTTP status codes returned by the API
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left p-3 text-white/70">Code</th>
                            <th className="text-left p-3 text-white/70">Name</th>
                            <th className="text-left p-3 text-white/70">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {responseCodes.map((code) => (
                            <motion.tr
                              key={code.code}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="border-b border-white/5 hover:bg-white/5 transition-colors"
                            >
                              <td className="p-3">
                                <Badge className={`${code.color} bg-transparent border`}>
                                  {code.code}
                                </Badge>
                              </td>
                              <td className="p-3 text-white/90 font-semibold">{code.name}</td>
                              <td className="p-3 text-white/70">{code.description}</td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
