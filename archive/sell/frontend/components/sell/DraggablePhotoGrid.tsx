"use client"

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X, Pin } from 'lucide-react'
import { motion } from 'framer-motion'

interface DraggablePhotoGridProps {
  images: File[]
  previews: string[]
  onReorder: (newOrder: File[], newPreviews: string[]) => void
  onRemove: (index: number) => void
}

interface SortablePhotoItemProps {
  id: string
  index: number
  preview: string
  isPrimary: boolean
  onRemove: () => void
}

function SortablePhotoItem({ id, index, preview, isPrimary, onRemove }: SortablePhotoItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative group"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={preview}
        alt={`Photo ${index + 1}`}
        className="w-full h-32 object-cover rounded-lg border-2 border-[#2a2d3a] cursor-grab active:cursor-grabbing"
        draggable={false}
      />
      
      {/* Primary Badge */}
      {isPrimary && (
        <div className="absolute top-2 left-2 bg-[#5B7FFF] text-white text-xs px-2 py-1 rounded flex items-center gap-1">
          <Pin className="h-3 w-3" />
          Primary
        </div>
      )}

      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-10 bg-black/50 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-white" />
      </div>

      {/* Remove Button */}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  )
}

export function DraggablePhotoGrid({
  images,
  previews,
  onReorder,
  onRemove,
}: DraggablePhotoGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = images.findIndex((_, i) => `photo-${i}` === active.id)
      const newIndex = images.findIndex((_, i) => `photo-${i}` === over.id)

      const newImages = arrayMove(images, oldIndex, newIndex)
      const newPreviews = arrayMove(previews, oldIndex, newIndex)

      onReorder(newImages, newPreviews)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={images.map((_, i) => `photo-${i}`)}
        strategy={rectSortingStrategy}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {images.map((_, index) => (
            <SortablePhotoItem
              key={`photo-${index}`}
              id={`photo-${index}`}
              index={index}
              preview={previews[index]}
              isPrimary={index === 0}
              onRemove={() => onRemove(index)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}