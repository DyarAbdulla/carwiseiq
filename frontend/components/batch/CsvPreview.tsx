'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CheckCircle2, X } from 'lucide-react'

interface CsvPreviewProps {
  previewData: any[]
  headers: string[]
  onConfirm: () => void
  onCancel: () => void
}

export function CsvPreview({ previewData, headers, onConfirm, onCancel }: CsvPreviewProps) {
  if (previewData.length === 0) return null

  return (
    <Card className="border-[#5B7FFF]/30 bg-[#1a1d29]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>CSV Preview</CardTitle>
            <CardDescription className="text-[#94a3b8]">
              First 5 rows - Verify data looks correct before processing
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-[#94a3b8] hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto -mx-4 px-4">
          <Table>
            <TableHeader>
              <TableRow className="border-[#2a2d3a]">
                {headers.map((header) => (
                  <TableHead key={header} className="text-[#94a3b8]">
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewData.map((row, index) => (
                <TableRow key={index} className="border-[#2a2d3a]">
                  {headers.map((header) => (
                    <TableCell key={header} className="text-white">
                      {String(row[header] || '')}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center gap-4 pt-4 border-t border-[#2a2d3a]">
          <div className="flex items-center gap-2 text-sm text-[#94a3b8]">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Required columns found: year, make, model, mileage</span>
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onCancel} className="border-[#2a2d3a]">
              Upload Different File
            </Button>
            <Button onClick={onConfirm} className="bg-[#5B7FFF] hover:bg-[#5B7FFF]/90">
              Process Batch
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
