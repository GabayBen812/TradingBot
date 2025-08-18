import React, { useRef } from 'react'

export default function ImagesGallery({
	title,
	existingUrls,
	onRemoveExisting,
	newPreviews,
	onAddFiles,
	onRemoveNew,
}: {
	title: string
	existingUrls: string[]
	onRemoveExisting: (idx: number) => void
	newPreviews: string[]
	onAddFiles: (files: FileList) => void
	onRemoveNew: (idx: number) => void
}) {
	const inputRef = useRef<HTMLInputElement | null>(null)
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between">
				<span className="text-sm text-gray-300">{title}</span>
				<div className="flex items-center gap-2">
					<button type="button" onClick={() => inputRef.current?.click()} className="text-sm bg-gray-700 hover:bg-gray-600 rounded px-3 py-1">+</button>
				</div>
			</div>
			<input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e)=> e.target.files && onAddFiles(e.target.files)} />
			<div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
				{existingUrls.map((url, idx) => (
					<div key={`old-${idx}`} className="relative">
						<img src={url} alt="screenshot" className="w-full h-24 object-cover rounded" />
						<button type="button" onClick={() => onRemoveExisting(idx)} className="absolute top-1 right-1 bg-black/60 rounded px-1 text-xs">×</button>
					</div>
				))}
				{newPreviews.map((url, idx) => (
					<div key={`new-${idx}`} className="relative">
						<img src={url} alt="preview" className="w-full h-24 object-cover rounded" />
						<button type="button" onClick={() => onRemoveNew(idx)} className="absolute top-1 right-1 bg-black/60 rounded px-1 text-xs">×</button>
					</div>
				))}
			</div>
		</div>
	)
}
