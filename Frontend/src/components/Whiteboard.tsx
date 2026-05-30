import React, { useState, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Pencil,
  Square,
  Circle,
  Type,
  StickyNote,
  Eraser,
  Undo,
  Redo,
  Download,
  Trash2,
  Move,
  ImageIcon,
  Palette,
  MousePointer,
  Minus,
} from 'lucide-react';
import { toast } from 'sonner';

type Tool = 'select' | 'pencil' | 'rectangle' | 'circle' | 'line' | 'text' | 'sticky' | 'eraser';

interface StickyNote {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

interface TextElement {
  id: string;
  x: number;
  y: number;
  text: string;
}

const colors = [
  '#3AB4FF', // Primary blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#000000', // Black
  '#FFFFFF', // White
];

const stickyColors = [
  '#FEF3C7', // Yellow
  '#DBEAFE', // Blue
  '#D1FAE5', // Green
  '#FCE7F3', // Pink
  '#E9D5FF', // Purple
];

export default function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTool, setActiveTool] = useState<Tool>('pencil');
  const [activeColor, setActiveColor] = useState('#3AB4FF');
  const [brushSize, setBrushSize] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [stickyNotes, setStickyNotes] = useState<StickyNote[]>([
    { id: '1', x: 100, y: 100, text: 'Welcome to the whiteboard!', color: stickyColors[0] },
    { id: '2', x: 300, y: 200, text: 'Drag me around!', color: stickyColors[1] },
  ]);
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const [draggedNote, setDraggedNote] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [newStickyText, setNewStickyText] = useState('');
  const [showStickyInput, setShowStickyInput] = useState(false);
  const [stickyPosition, setStickyPosition] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const savedImageRef = useRef<ImageData | null>(null);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'select' || activeTool === 'sticky' || activeTool === 'text') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    savedImageRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setStartPos({ x, y });
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = activeTool === 'eraser' ? '#F8FAFC' : activeColor;
    ctx.lineWidth = activeTool === 'eraser' ? brushSize * 3 : brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    setIsDrawing(true);
  }, [activeTool, activeColor, brushSize]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (activeTool === 'pencil' || activeTool === 'eraser') {
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'line') {
      if (savedImageRef.current) {
        ctx.putImageData(savedImageRef.current, 0, 0);
      }
      ctx.beginPath();
      if (activeTool === 'line') {
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(x, y);
      } else if (activeTool === 'rectangle') {
        ctx.rect(startPos.x, startPos.y, x - startPos.x, y - startPos.y);
      } else if (activeTool === 'circle') {
        const radius = Math.sqrt(Math.pow(x - startPos.x, 2) + Math.pow(y - startPos.y, 2));
        ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
      }
      ctx.stroke();
    }
  }, [isDrawing, activeTool, startPos]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'sticky') {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setStickyPosition({ 
          x: e.clientX - rect.left, 
          y: e.clientY - rect.top 
        });
        setShowStickyInput(true);
      }
    } else if (activeTool === 'text') {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const text = prompt('Enter text:');
        if (text) {
          setTextElements(prev => [...prev, {
            id: `text-${Date.now()}`,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            text,
          }]);
        }
      }
    }
  };

  const addStickyNote = () => {
    if (!newStickyText.trim()) return;
    
    const newNote: StickyNote = {
      id: `sticky-${Date.now()}`,
      x: stickyPosition.x,
      y: stickyPosition.y,
      text: newStickyText,
      color: stickyColors[Math.floor(Math.random() * stickyColors.length)],
    };
    
    setStickyNotes(prev => [...prev, newNote]);
    setNewStickyText('');
    setShowStickyInput(false);
    toast.success('Sticky note added!');
  };

  const handleNoteDragStart = (e: React.MouseEvent, noteId: string) => {
    const note = stickyNotes.find(n => n.id === noteId);
    if (!note) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setDraggedNote(noteId);
    setDragOffset({
      x: e.clientX - rect.left - note.x,
      y: e.clientY - rect.top - note.y,
    });
  };

  const handleNoteDrag = useCallback((e: React.MouseEvent) => {
    if (!draggedNote) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setStickyNotes(prev =>
      prev.map(note =>
        note.id === draggedNote
          ? { 
              ...note, 
              x: e.clientX - rect.left - dragOffset.x, 
              y: e.clientY - rect.top - dragOffset.y 
            }
          : note
      )
    );
  }, [draggedNote, dragOffset]);

  const handleNoteDragEnd = () => {
    setDraggedNote(null);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setStickyNotes([]);
    setTextElements([]);
    toast.info('Canvas cleared');
  };

  const exportCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = 'whiteboard.png';
    link.href = canvas.toDataURL();
    link.click();
    toast.success('Whiteboard exported!');
  };

  const tools: { id: Tool; icon: React.ElementType; label: string }[] = [
    { id: 'select', icon: MousePointer, label: 'Select' },
    { id: 'pencil', icon: Pencil, label: 'Pencil' },
    { id: 'line', icon: Minus, label: 'Line' },
    { id: 'rectangle', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'sticky', icon: StickyNote, label: 'Sticky Note' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
  ];

  return (
    <div className="h-full flex flex-col p-4">
      {/* Toolbar */}
      <Card className="mb-4 p-2 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
        {/* Tools */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {tools.map(tool => (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <Button
                  variant={activeTool === tool.id ? "default" : "ghost"}
                  size="icon"
                  className={cn(
                    "h-9 w-9",
                    activeTool === tool.id && "gradient-bg"
                  )}
                  onClick={() => setActiveTool(tool.id)}
                >
                  <tool.icon className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{tool.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        
        <Separator orientation="vertical" className="h-8" />
        
        {/* Colors */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Palette className="w-4 h-4 text-muted-foreground mr-1" />
          {colors.map(color => (
            <button
              key={color}
              className={cn(
                "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110",
                activeColor === color ? "border-foreground scale-110" : "border-transparent"
              )}
              style={{ backgroundColor: color }}
              onClick={() => setActiveColor(color)}
            />
          ))}
        </div>
        
        <Separator orientation="vertical" className="h-8" />
        
        {/* Brush size */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm text-muted-foreground">Size:</span>
          <input
            type="range"
            min="1"
            max="20"
            value={brushSize}
            onChange={e => setBrushSize(Number(e.target.value))}
            className="w-20"
          />
          <span className="text-sm w-6">{brushSize}</span>
        </div>
        
        <Separator orientation="vertical" className="h-8" />
        
        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Undo className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Redo className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={clearCanvas}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear canvas</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={exportCanvas}>
                <Download className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export as image</TooltipContent>
          </Tooltip>
        </div>
        
        <div className="flex-1" />
        
        <Button variant="outline" size="sm">
          <ImageIcon className="w-4 h-4 mr-2" />
          Add Image
        </Button>
      </Card>
      
      {/* Canvas area */}
      <div 
        className="flex-1 relative bg-card rounded-xl border border-border overflow-auto"
        onMouseMove={handleNoteDrag}
        onMouseUp={handleNoteDragEnd}
        onMouseLeave={handleNoteDragEnd}
      >
        <div className="relative min-w-[1200px] min-h-[800px] h-full" style={{ width: '100%', height: '100%' }}>
          <canvas
            ref={canvasRef}
            width={1200}
            height={800}
            className="absolute inset-0 w-full h-full cursor-crosshair bg-white"
          style={{ 
            cursor: activeTool === 'pencil' ? 'crosshair' : 
                   activeTool === 'eraser' ? 'cell' : 
                   activeTool === 'select' ? 'default' : 'crosshair'
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onClick={handleCanvasClick}
        />
        
        {/* Sticky notes */}
        {stickyNotes.map(note => (
          <div
            key={note.id}
            className="absolute p-3 rounded-lg shadow-md cursor-move select-none animate-bounce-in"
            style={{
              left: note.x,
              top: note.y,
              backgroundColor: note.color,
              width: 150,
              minHeight: 100,
            }}
            onMouseDown={(e) => handleNoteDragStart(e, note.id)}
          >
            <p className="text-sm text-foreground/80">{note.text}</p>
            <button
              className="absolute top-1 right-1 text-foreground/40 hover:text-destructive transition-colors"
              onClick={() => setStickyNotes(prev => prev.filter(n => n.id !== note.id))}
            >
              ×
            </button>
          </div>
        ))}
        
        {/* Text elements */}
        {textElements.map(text => (
          <div
            key={text.id}
            className="absolute text-foreground font-medium select-none"
            style={{ left: text.x, top: text.y, color: activeColor }}
          >
            {text.text}
          </div>
        ))}
        
        {/* Sticky note input */}
        {showStickyInput && (
          <div
            className="absolute bg-card p-3 rounded-lg shadow-lg border border-border animate-bounce-in z-10"
            style={{ left: stickyPosition.x, top: stickyPosition.y }}
          >
            <Input
              placeholder="Enter note text..."
              value={newStickyText}
              onChange={e => setNewStickyText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addStickyNote()}
              className="mb-2"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={addStickyNote}>Add</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowStickyInput(false)}>Cancel</Button>
            </div>
          </div>
        )}
        
        {/* Grid pattern background */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        </div>
      </div>
    </div>
  );
}
