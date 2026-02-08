import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Get query parameters
    let title = decodeURIComponent(searchParams.get('title') || 'Car Listing')
    const price = searchParams.get('price') || '$0'
    let image = decodeURIComponent(searchParams.get('image') || '')

    // Truncate title if too long (max 60 chars for better display)
    if (title.length > 60) {
      title = title.substring(0, 57) + '...'
    }

    // Format price with proper formatting
    const formattedPrice = price.startsWith('$') ? price : `$${price}`

    // Ensure image URL is absolute (required for @vercel/og)
    // If it's a relative URL, we can't fetch it, so we'll use empty string
    if (image && !image.startsWith('http://') && !image.startsWith('https://')) {
      image = ''
    }

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'stretch',
            background: 'linear-gradient(135deg, #020617 0%, #1e1b4b 100%)',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          {/* Left Side: Car Image (60%) */}
          <div
            style={{
              width: '60%',
              height: '100%',
              display: 'flex',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {image ? (
              <img
                src={image}
                alt={title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  fontSize: 24,
                }}
              >
                No Image
              </div>
            )}
            {/* Gradient overlay for better text readability */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '40%',
                background: 'linear-gradient(to top, rgba(2, 6, 23, 0.9) 0%, transparent 100%)',
              }}
            />
          </div>

          {/* Right Side: Glass Panel (40%) */}
          <div
            style={{
              width: '40%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              padding: '60px 50px',
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
              justifyContent: 'space-between',
            }}
          >
            {/* Top: Logo */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '40px',
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  backgroundClip: 'text',
                  color: 'transparent',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                CarWiseIQ
              </div>
            </div>

            {/* Middle: Content */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                justifyContent: 'center',
                gap: '30px',
              }}
            >
              {/* Car Title */}
              <div
                style={{
                  fontSize: 42,
                  fontWeight: 700,
                  color: '#ffffff',
                  lineHeight: 1.2,
                  display: 'flex',
                  flexWrap: 'wrap',
                }}
              >
                {title}
              </div>

              {/* Price */}
              <div
                style={{
                  fontSize: 64,
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  backgroundClip: 'text',
                  color: 'transparent',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  lineHeight: 1,
                }}
              >
                {formattedPrice}
              </div>

              {/* Verified Badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 20px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '8px',
                  width: 'fit-content',
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    color: '#ffffff',
                  }}
                >
                  ✓
                </div>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: '#10b981',
                  }}
                >
                  Verified Listing
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  } catch (e: any) {
    console.error('Error generating OG image:', e)
    return new Response(`Failed to generate image: ${e.message}`, { status: 500 })
  }
}
