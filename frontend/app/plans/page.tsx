"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { ListTodo, Loader2, CheckCircle2, Bot, MessageSquare, Home as HomeIcon, Mic, MicOff, Pencil, X, Check as CheckIcon, Trash2, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Button } from '@/components/ui/button';
import { useVoiceDictation } from "@/components/useVoiceDictation";
import { useTextToSpeech } from "@/components/useTextToSpeech";

// Updated Plan interface to match backend model
interface Plan {
  id: string; // Changed from number to string to match MongoDB ObjectId
  title: string;
  description: string;
  status: string; // "todo", "inprogress", "done"
  created_at?: string;
  updated_at?: string;
}

// Define column types for status mapping
type ColumnId = "todo" | "inprogress" | "done";

interface Column {
  name: string;
  items: Plan[];
}

interface Columns {
  todo: Column;
  inprogress: Column;
  done: Column;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

const PlansPage = () => {
  const { speakingId, speak, stop } = useTextToSpeech();
  const [columns, setColumns] = useState<Columns>({
    todo: { name: 'To Do', items: [] },
    inprogress: { name: 'In Progress', items: [] },
    done: { name: 'Done', items: [] },
  });
  const [editing, setEditing] = useState<{ col: ColumnId, id: string, title: string, description: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const {
    input,
    setInput,
    listening,
    toggleListening,
    browserSupportsSpeechRecognition,
    resetTranscript
  } = useVoiceDictation('');

  const fetchPlans = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/plans/`);
      if (!response.ok) throw new Error('Failed to fetch plans');
      const plansFromApi: any[] = await response.json(); // Use any[] for initial parsing
      
      const newColumns: Columns = {
        todo: { name: 'To Do', items: [] },
        inprogress: { name: 'In Progress', items: [] },
        done: { name: 'Done', items: [] },
      };

      // Map API response to frontend Plan interface, specifically handling _id to id
      const mappedPlans: Plan[] = plansFromApi.map(p => ({
        id: p._id, // Map _id to id
        title: p.title,
        description: p.description,
        status: p.status,
        created_at: p.created_at,
        updated_at: p.updated_at,
      }));

      mappedPlans.forEach(plan => {
        if (plan.status === 'todo') newColumns.todo.items.push(plan);
        else if (plan.status === 'inprogress') newColumns.inprogress.items.push(plan);
        else if (plan.status === 'done') newColumns.done.items.push(plan);
        // Add a fallback or warning for plans with unexpected status
        else {
          console.warn(`Plan with id ${plan.id} has unknown status: ${plan.status}`);
        }
      });
      setColumns(newColumns);
    } catch (error) {
      console.error("Error fetching plans:", error);
      // Handle error display to user if necessary
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const addPlan = async () => {
    if (input.trim() === '') return;
    const newPlanData = {
      title: input.trim(),
      description: input.trim(), // For now, description is same as title
      status: 'todo' as ColumnId,
    };
    try {
      const response = await fetch(`${API_BASE_URL}/plans/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlanData),
      });
      if (!response.ok) throw new Error('Failed to add plan');
      // const createdPlan: Plan = await response.json(); // Use this if you need the created plan details immediately
      await fetchPlans(); // Refetch all plans to update UI
      setInput('');
      resetTranscript();
    } catch (error) {
      console.error("Error adding plan:", error);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (window.confirm('Are you sure you want to delete this plan?')) {
      try {
        const response = await fetch(`${API_BASE_URL}/plans/${planId}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete plan');
        await fetchPlans(); // Refetch plans
        if (editing && editing.id === planId) {
          setEditing(null);
        }
      } catch (error) {
        console.error("Error deleting plan:", error);
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const { id, title, description, col } = editing;
    try {
      const response = await fetch(`${API_BASE_URL}/plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, status: col }), // col (status) might not be editable here, depends on UI
      });
      if (!response.ok) throw new Error('Failed to update plan');
      await fetchPlans(); // Refetch plans
      setEditing(null);
    } catch (error) {
      console.error("Error updating plan:", error);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    // If dropped in the same place
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceColId = source.droppableId as ColumnId;
    const destColId = destination.droppableId as ColumnId;
    
    // Optimistically update UI
    const sourceCol = columns[sourceColId];
    const destCol = columns[destColId];
    const sourceItems = Array.from(sourceCol.items);
    const [movedItem] = sourceItems.splice(source.index, 1);
    movedItem.status = destColId; // Update status on the item for optimistic update

    const newColumnsState = JSON.parse(JSON.stringify(columns)) as Columns; // Deep copy
    newColumnsState[sourceColId].items.splice(source.index, 1);
    newColumnsState[destColId].items.splice(destination.index, 0, movedItem);
    setColumns(newColumnsState);

    // Update backend
    try {
      const response = await fetch(`${API_BASE_URL}/plans/${draggableId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: destColId }),
      });
      if (!response.ok) {
        throw new Error('Failed to update plan status on backend');
      }
      // Optionally refetch plans if optimistic update is not fully trusted or for consistency
      // await fetchPlans(); 
    } catch (error) {
      console.error("Error updating plan status:", error);
      // Revert optimistic update if backend call fails
      // This is a simplified example; a more robust solution might involve originalColumns state
      fetchPlans(); // Refetch to ensure consistency after error
    }
  };
  
  function togglePlanSpeech(planId: string, text: string) {
    if (speakingId === planId) {
      stop();
    } else {
      speak(planId, text);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary">
      {/* Navigation Bar */}
      <nav className="w-full border-b border-border bg-background/80 sticky top-0 z-10 backdrop-blur">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Bot className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold">AnalyticAI</span>
          </div>
          <div className="flex gap-3 items-center">
            <Link href="/"><Button variant="ghost" size="sm" className="flex items-center gap-2"><HomeIcon className="h-4 w-4" /> Home</Button></Link>
            <Link href="/chat"><Button variant="ghost" size="sm" className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Chat</Button></Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>
      {/* Main Content */}
      <div className="container mx-auto px-4 pt-12 pb-16">
        <h1 className="text-3xl font-bold text-center mb-8">Strategy Plans Board</h1>
        <div className="flex justify-center mb-8 gap-2">
          <input
            className="border border-input rounded-l-md px-4 py-2 focus:outline-none w-72 text-base bg-background"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Add a new plan title..."
          />
          {browserSupportsSpeechRecognition && (
            <Button
              type="button"
              variant="outline"
              className={`rounded-none ${listening ? 'bg-primary text-primary-foreground' : ''}`}
              onClick={toggleListening}
              title={listening ? 'Stop voice input' : 'Start voice input'}
            >
              {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
          )}
          <button
            className="bg-primary text-white px-5 py-2 rounded-r-md font-medium hover:bg-primary/90 transition"
            onClick={addPlan}
          >
            Add Plan
          </button>
        </div>
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(columns).map(([colId, colData]) => (
              <div key={colId} className="bg-card rounded-lg p-4 min-h-[350px] shadow-sm flex flex-col">
                <h2 className="text-xl font-semibold text-center mb-4">{colData.name}</h2>
                <Droppable droppableId={colId} key={colId}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 space-y-4 transition-colors ${snapshot.isDraggingOver ? 'bg-secondary' : ''} p-1 rounded`}
                    >
                      {colData.items.map((plan: Plan, idx: number) => {
                        // Ensure plan.id is a valid string before rendering Draggable
                        if (!plan || typeof plan.id !== 'string' || plan.id.trim() === '') {
                          console.warn('Skipping rendering Draggable due to invalid plan or plan.id:', plan);
                          return null; // Or some placeholder if you prefer
                        }
                        return (
                          <Draggable draggableId={plan.id} index={idx} key={plan.id}>
                            {(providedDraggable, snapshotDraggable) => (
                              <div
                                ref={providedDraggable.innerRef}
                                {...providedDraggable.draggableProps}
                                {...providedDraggable.dragHandleProps}
                                className={`bg-white dark:bg-neutral-800 rounded shadow flex flex-col gap-2 p-3 mb-2 ${snapshotDraggable.isDragging ? 'ring-2 ring-primary' : ''}`}
                              >
                                {editing && editing.id === plan.id ? (
                                  <>
                                    <input
                                      className="border rounded px-2 py-1 text-base w-full dark:bg-neutral-700 dark:text-white"
                                      value={editing.title}
                                      onChange={e => setEditing({...editing, title: e.target.value})}
                                      autoFocus
                                      placeholder="Plan title"
                                    />
                                    <textarea
                                      className="border rounded px-2 py-1 text-sm w-full h-20 dark:bg-neutral-700 dark:text-white"
                                      value={editing.description}
                                      onChange={e => setEditing({...editing, description: e.target.value})}
                                      placeholder="Plan description"
                                    />
                                    <div className="flex justify-end gap-2 mt-2">
                                      <Button size="sm" variant="outline" onClick={() => setEditing(null)}><X className="w-4 h-4 mr-1" /> Cancel</Button>
                                      <Button size="sm" onClick={handleSaveEdit}><CheckIcon className="w-4 h-4 mr-1" /> Save</Button>
                                    </div>
                                  </> 
                                ) : (
                                  <>
                                    <div className="flex items-center justify-between">
                                      <span className={`font-medium text-base ${plan.status === 'done' ? 'opacity-60 line-through' : ''}`}>{plan.title}</span>
                                      <div className="flex items-center gap-1">
                                        {colId === 'todo' && <ListTodo className="text-blue-500 w-5 h-5 shrink-0" />}
                                        {colId === 'inprogress' && <Loader2 className="text-yellow-500 animate-spin w-5 h-5 shrink-0" />}
                                        {colId === 'done' && <CheckCircle2 className="text-green-600 w-5 h-5 shrink-0" />}
                                      </div>
                                    </div>
                                    {plan.description && <p className={`text-sm text-gray-600 dark:text-gray-400 ${plan.status === 'done' ? 'opacity-60 line-through' : ''}`}>{plan.description}</p>}
                                    <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                      <Button variant="ghost" size="icon" className={`h-7 w-7 ${speakingId === plan.id ? 'text-primary' : 'text-gray-400 hover:text-primary'}`} onClick={() => togglePlanSpeech(plan.id, `${plan.title}. ${plan.description}`)} title={speakingId === plan.id ? 'Stop speaking' : 'Speak plan'}>
                                        <Volume2 className="w-4 h-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-primary" onClick={() => setEditing({col: plan.status as ColumnId, id: plan.id, title: plan.title, description: plan.description})} title="Edit plan">
                                        <Pencil className="w-4 h-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => handleDeletePlan(plan.id)} title="Delete plan">
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </> 
                                )}
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
};

export default PlansPage;

