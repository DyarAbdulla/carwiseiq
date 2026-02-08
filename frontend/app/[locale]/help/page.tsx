"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { HelpCircle, Book, MessageSquare, Shield, TrendingUp, Car, Search } from 'lucide-react'

export default function HelpPage() {
  return (
    <div className="container px-4 sm:px-6 lg:px-8 py-6 md:py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">Help & Support</h1>
          <p className="text-[#94a3b8] text-lg">Find answers to common questions and learn how to use our platform</p>
        </div>

        {/* Quick Links */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Card className="border-[#2a2d3a] bg-[#1a1d29] hover:border-[#5B7FFF]/50 transition-all cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Car className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Create a Listing</h3>
                  <p className="text-sm text-[#94a3b8]">Learn how to list your car for sale</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#2a2d3a] bg-[#1a1d29] hover:border-[#5B7FFF]/50 transition-all cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <Search className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Search for Cars</h3>
                  <p className="text-sm text-[#94a3b8]">Find your perfect car</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#2a2d3a] bg-[#1a1d29] hover:border-[#5B7FFF]/50 transition-all cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Price Prediction</h3>
                  <p className="text-sm text-[#94a3b8]">Get AI-powered price estimates</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#2a2d3a] bg-[#1a1d29] hover:border-[#5B7FFF]/50 transition-all cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-500/10 rounded-lg">
                  <Shield className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Safety Tips</h3>
                  <p className="text-sm text-[#94a3b8]">Stay safe when buying/selling</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQ */}
        <Card className="border-[#2a2d3a] bg-[#1a1d29] mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Frequently Asked Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1" className="border-[#2a2d3a]">
                <AccordionTrigger className="text-white hover:text-[#5B7FFF]">
                  How do I create a car listing?
                </AccordionTrigger>
                <AccordionContent className="text-[#94a3b8]">
                  <ol className="list-decimal list-inside space-y-2">
                    <li>Click "Sell" in the navigation menu</li>
                    <li>Fill in your car's details (make, model, year, mileage, condition, etc.)</li>
                    <li>Upload photos of your car</li>
                    <li>Set your asking price</li>
                    <li>Add contact information</li>
                    <li>Publish your listing</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="border-[#2a2d3a]">
                <AccordionTrigger className="text-white hover:text-[#5B7FFF]">
                  How accurate is the price prediction?
                </AccordionTrigger>
                <AccordionContent className="text-[#94a3b8]">
                  Our AI model is trained on thousands of car listings and achieves high accuracy. 
                  The prediction includes a confidence interval to show the price range. 
                  Actual prices may vary based on market conditions, location, and negotiation.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="border-[#2a2d3a]">
                <AccordionTrigger className="text-white hover:text-[#5B7FFF]">
                  How do I contact a seller?
                </AccordionTrigger>
                <AccordionContent className="text-[#94a3b8]">
                  Click "Send Message" on any listing to start a conversation with the seller. 
                  You can also call them directly if they've provided a phone number. 
                  Always meet in public places and verify the vehicle before payment.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="border-[#2a2d3a]">
                <AccordionTrigger className="text-white hover:text-[#5B7FFF]">
                  Can I compare multiple cars?
                </AccordionTrigger>
                <AccordionContent className="text-[#94a3b8]">
                  Yes! Click the "Compare" button on up to 3 listings, then click "Compare" 
                  in the comparison bar at the bottom to see them side-by-side with all specs, 
                  features, and price differences.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5" className="border-[#2a2d3a]">
                <AccordionTrigger className="text-white hover:text-[#5B7FFF]">
                  How do I view analytics for my listing?
                </AccordionTrigger>
                <AccordionContent className="text-[#94a3b8]">
                  Go to "My Listings" from your profile menu, then click the analytics icon 
                  on any of your listings. You'll see views, favorites, messages, engagement rate, 
                  and suggestions to improve your listing.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6" className="border-[#2a2d3a]">
                <AccordionTrigger className="text-white hover:text-[#5B7FFF]">
                  Is it safe to buy/sell on this platform?
                </AccordionTrigger>
                <AccordionContent className="text-[#94a3b8]">
                  We recommend:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Always meet in public places</li>
                    <li>Verify the vehicle before payment</li>
                    <li>Check vehicle history reports</li>
                    <li>Use secure payment methods</li>
                    <li>Trust your instincts - if something seems off, walk away</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Contact Support */}
        <Card className="border-[#2a2d3a] bg-[#1a1d29]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Still Need Help?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[#94a3b8] mb-4">
              Can't find what you're looking for? Contact our support team:
            </p>
            <div className="space-y-2">
              <p className="text-white">
                <strong>Email:</strong> support@carpricepredictor.com
              </p>
              <p className="text-white">
                <strong>Response Time:</strong> Within 24 hours
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
