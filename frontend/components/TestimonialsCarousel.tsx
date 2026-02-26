"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Star, ChevronLeft, ChevronRight } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface Testimonial {
  name: string
  location: string
  text: string
  rating: number
}

export function TestimonialsCarousel() {
  const t = useTranslations("home.testimonials")
  const [index, setIndex] = useState(0)

  const testimonials: Testimonial[] = [
    { name: t("t1.name"), location: t("t1.location"), text: t("t1.text"), rating: 5 },
    { name: t("t2.name"), location: t("t2.location"), text: t("t2.text"), rating: 5 },
    { name: t("t3.name"), location: t("t3.location"), text: t("t3.text"), rating: 5 },
    { name: t("t4.name"), location: t("t4.location"), text: t("t4.text"), rating: 5 },
  ]

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % testimonials.length), 5000)
    return () => clearInterval(id)
  }, [testimonials.length])

  const current = testimonials[index]

  return (
    <section className="w-full py-12 sm:py-16" aria-labelledby="testimonials-title">
      <div className="container mx-auto px-3 sm:px-6 max-w-6xl">
        <h2 id="testimonials-title" className="text-xl sm:text-2xl md:text-3xl font-bold text-center mb-8 text-slate-900 dark:text-white">
          {t("title")}
        </h2>
        <div className="relative max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border border-white/10 bg-white/[0.03] backdrop-blur-xl">
                <CardHeader>
                  <div className="flex items-center gap-1 mb-2">
                    {Array.from({ length: current.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" aria-hidden />
                    ))}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 italic">&quot;{current.text}&quot;</p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
                      {current.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{current.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{current.location}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + testimonials.length) % testimonials.length)}
              className="min-h-[44px] min-w-[44px] rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-900 dark:text-white touch-manipulation"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            {testimonials.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className={`min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center touch-manipulation ${
                  i === index ? "bg-indigo-500 text-white" : "bg-white/10 hover:bg-white/20"
                }`}
                aria-label={`Go to testimonial ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
              >
                <span className="sr-only">Testimonial {i + 1}</span>
                <span className="w-2 h-2 rounded-full bg-current" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % testimonials.length)}
              className="min-h-[44px] min-w-[44px] rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-900 dark:text-white touch-manipulation"
              aria-label="Next testimonial"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
