'use client'

import React from 'react'

/**
 * Skeleton/Esqueleto da página Templates de Notificações
 * Representa a estrutura visual enquanto o conteúdo carrega
 */
export default function TemplatesSectionSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-lg" />
          <div>
            <div className="h-6 w-48 bg-gray-200 rounded" />
            <div className="h-4 w-64 bg-gray-200 rounded mt-2" />
          </div>
        </div>
        <div className="flex gap-3">
          <div className="h-9 w-32 bg-gray-200 rounded-lg" />
          <div className="h-9 w-36 bg-gray-200 rounded-lg" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
            <div className="h-8 w-12 bg-gray-200 rounded" />
          </div>
        ))}
      </div>

      {/* Templates List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* List Header */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-5 gap-4">
            <div className="h-4 w-20 bg-gray-200 rounded" />
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-4 w-16 bg-gray-200 rounded" />
            <div className="h-4 w-20 bg-gray-200 rounded" />
          </div>
        </div>

        {/* List Items */}
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="px-4 py-4 border-b border-gray-100 last:border-0">
            <div className="grid grid-cols-5 gap-4 items-center">
              <div className="h-5 w-8 bg-gray-200 rounded" />
              <div className="h-5 w-40 bg-gray-200 rounded" />
              <div className="h-5 w-24 bg-gray-200 rounded" />
              <div className="h-6 w-20 bg-gray-200 rounded-full" />
              <div className="flex gap-2">
                <div className="h-8 w-20 bg-gray-200 rounded" />
                <div className="h-8 w-20 bg-gray-200 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Editor Modal Skeleton (overlay simulation) */}
      <div className="fixed inset-0 bg-black/50 z-50 hidden">
        <div className="absolute inset-10 bg-white rounded-lg shadow-xl">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="h-6 w-48 bg-gray-200 rounded" />
            <div className="h-8 w-8 bg-gray-200 rounded" />
          </div>

          {/* Modal Body */}
          <div className="p-6 grid grid-cols-2 gap-6 h-[calc(100%-140px)]">
            {/* Left - Editor */}
            <div className="space-y-4">
              {/* Toolbar */}
              <div className="h-10 bg-gray-100 rounded flex gap-2 px-2 items-center">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="h-6 w-6 bg-gray-200 rounded" />
                ))}
              </div>
              {/* Editor Area */}
              <div className="h-[300px] bg-gray-100 rounded border border-gray-200" />
              {/* Variables */}
              <div className="h-20 bg-gray-100 rounded border border-gray-200 p-3">
                <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-6 w-20 bg-gray-200 rounded" />
                  ))}
                </div>
              </div>
            </div>

            {/* Right - Preview */}
            <div className="space-y-4">
              <div className="h-6 w-32 bg-gray-200 rounded" />
              <div className="h-[350px] bg-gray-100 rounded border border-gray-200" />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="absolute bottom-0 left-0 right-0 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <div className="h-10 w-24 bg-gray-200 rounded" />
            <div className="h-10 w-32 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}
