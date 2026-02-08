"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { HelpCircle } from 'lucide-react'

export default function FAQPage() {
  return (
    <div className="container px-4 sm:px-6 lg:px-8 py-6 md:py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">Frequently Asked Questions</h1>
          <p className="text-[#94a3b8] text-lg">Find answers to common questions about our platform</p>
        </div>

        <Card className="border-[#2a2d3a] bg-[#1a1d29]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              General Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1" className="border-[#2a2d3a]">
                <AccordionTrigger className="text-white hover:text-[#5B7FFF]">
                  How does the price prediction work?
                </AccordionTrigger>
                <AccordionContent className="text-[#94a3b8]">
                  Our AI model analyzes thousands of car listings and uses machine learning to predict prices based on make, model, year, mileage, condition, location, and other factors. The prediction includes a confidence interval showing the expected price range.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="border-[#2a2d3a]">
                <AccordionTrigger className="text-white hover:text-[#5B7FFF]">
                  Is the service free to use?
                </AccordionTrigger>
                <AccordionContent className="text-[#94a3b8]">
                  Yes! Price predictions, searching, and comparing cars are completely free. There are no hidden fees for buyers. Sellers may have listing fees depending on the plan.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="border-[#2a2d3a]">
                <AccordionTrigger className="text-white hover:text-[#5B7FFF]">
                  How do I contact a seller?
                </AccordionTrigger>
                <AccordionContent className="text-[#94a3b8]">
                  Click "Send Message" on any listing to start a conversation. You can also call them directly if they've provided a phone number. Always meet in public places and verify the vehicle before payment.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="border-[#2a2d3a]">
                <AccordionTrigger className="text-white hover:text-[#5B7FFF]">
                  Can I save listings to view later?
                </AccordionTrigger>
                <AccordionContent className="text-[#94a3b8]">
                  Yes! Click the heart icon on any listing to save it to your favorites. You can access all saved listings from your profile menu.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5" className="border-[#2a2d3a]">
                <AccordionTrigger className="text-white hover:text-[#5B7FFF]">
                  How do I compare multiple cars?
                </AccordionTrigger>
                <AccordionContent className="text-[#94a3b8]">
                  Click the "Compare" button on up to 3 listings, then click "Compare" in the comparison bar at the bottom. You'll see a side-by-side comparison with all specs, features, and price differences.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
