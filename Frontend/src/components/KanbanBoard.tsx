import React, { useState } from 'react';
import { Task } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Plus, GripVertical, Calendar, User, Flag } from 'lucide-react';
import { toast } from 'sonner';

const initialTasks: Task[] = [
  { id: '1', title: 'Design new landing page', description: 'Create mockups for the new marketing site', status: 'todo', priority: 'high' },
  { id: '2', title: 'Review API documentation', description: 'Check for inconsistencies', status: 'todo', priority: 'medium' },
  { id: '3', title: 'Implement user auth', description: 'Add login/signup flows', status: 'in-progress', priority: 'high' },
  { id: '4', title: 'Fix navigation bug', description: 'Mobile menu not closing', status: 'in-progress', priority: 'low' },
  { id: '5', title: 'Setup CI/CD pipeline', description: 'GitHub Actions config', status: 'completed', priority: 'medium' },
  { id: '6', title: 'Write unit tests', description: 'Cover critical paths', status: 'completed', priority: 'high' },
];

const columns: { id: Task['status']; title: string; color: string }[] = [
  { id: 'todo', title: 'To Do', color: 'bg-muted' },
  { id: 'in-progress', title: 'In Progress', color: 'bg-primary/10' },
  { id: 'completed', title: 'Completed', color: 'bg-success/10' },
];

const priorityColors = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-warning/20 text-warning',
  high: 'bg-destructive/20 text-destructive',
};

interface TaskCardProps {
  task: Task;
  index: number;
  onDragStart: (e: React.DragEvent, taskId: string, index: number) => void;
  onDragEnter: (e: React.DragEvent, index: number) => void;
  isDragOver?: boolean;
}

function TaskCard({ task, index, onDragStart, onDragEnter, isDragOver }: TaskCardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id, index)}
      onDragEnter={(e) => onDragEnter(e, index)}
      className={cn(
        "bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all duration-200 group animate-fade-in",
        isDragOver && "border-primary border-2 scale-[1.02]"
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm mb-1 truncate">{task.title}</h4>
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className={cn("text-xs", priorityColors[task.priority])}>
              <Flag className="w-3 h-3 mr-1" />
              {task.priority}
            </Badge>
            {task.dueDate && (
              <Badge variant="outline" className="text-xs">
                <Calendar className="w-3 h-3 mr-1" />
                Due soon
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [draggedTask, setDraggedTask] = useState<{ id: string; status: Task['status']; index: number } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<{ status: Task['status']; index: number } | null>(null);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium' as Task['priority'] });
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleDragStart = (e: React.DragEvent, taskId: string, index: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setDraggedTask({ id: taskId, status: task.status, index });
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  const handleDragEnter = (status: Task['status'], index: number) => {
    if (draggedTask && draggedTask.status === status) {
      setDragOverIndex({ status, index });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, status: Task['status']) => {
    e.preventDefault();
    if (!draggedTask) return;

    const draggedTaskData = tasks.find(t => t.id === draggedTask.id);
    if (!draggedTaskData) return;

    // If dropping in same column, reorder
    if (draggedTask.status === status && dragOverIndex && dragOverIndex.status === status) {
      const columnTasks = tasks.filter(t => t.status === status);
      const otherTasks = tasks.filter(t => t.status !== status);
      
      // Remove from current position
      const [movedTask] = columnTasks.splice(draggedTask.index, 1);
      // Insert at new position
      const insertIndex = dragOverIndex.index > draggedTask.index ? dragOverIndex.index : dragOverIndex.index;
      columnTasks.splice(insertIndex, 0, movedTask);
      
      setTasks([...otherTasks, ...columnTasks]);
      toast.success('Task reordered!');
    } else if (draggedTask.status !== status) {
      // Moving to different column
      setTasks(prev =>
        prev.map(task =>
          task.id === draggedTask.id ? { ...task, status } : task
        )
      );
      toast.success('Task moved!');
    }
    
    setDraggedTask(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverIndex(null);
  };

  const handleAddTask = () => {
    if (!newTask.title.trim()) return;

    const task: Task = {
      id: `task-${Date.now()}`,
      title: newTask.title,
      description: newTask.description,
      status: 'todo',
      priority: newTask.priority,
    };

    setTasks(prev => [...prev, task]);
    setNewTask({ title: '', description: '', priority: 'medium' });
    setDialogOpen(false);
    toast.success('Task created!');
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Personal Tasks</h2>
          <p className="text-muted-foreground">Drag and drop to organize your tasks</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-bg shadow-glow">
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Task title"
                  value={newTask.title}
                  onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Task description (optional)"
                  value={newTask.description}
                  onChange={e => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select 
                  value={newTask.priority} 
                  onValueChange={(value: Task['priority']) => setNewTask(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddTask} className="w-full gradient-bg">
                Create Task
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
        {columns.map(column => {
          const columnTasks = tasks.filter(t => t.status === column.id);
          
          return (
            <Card 
              key={column.id}
              className={cn("flex flex-col", column.color)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
              onDragEnd={handleDragEnd}
            >
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  {column.title}
                  <Badge variant="secondary" className="ml-2">
                    {columnTasks.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 px-3 pb-3">
                <ScrollArea className="h-full">
                  <div className="space-y-2 pr-2">
                    {columnTasks.map((task, index) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        index={index}
                        onDragStart={handleDragStart}
                        onDragEnter={(e) => handleDragEnter(column.id, index)}
                        isDragOver={dragOverIndex?.status === column.id && dragOverIndex?.index === index && draggedTask?.id !== task.id}
                      />
                    ))}
                    
                    {columnTasks.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        Drop tasks here
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
