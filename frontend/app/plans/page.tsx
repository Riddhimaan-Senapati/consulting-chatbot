"use client";
import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { ListTodo, Loader2, CheckCircle2, Bot, MessageSquare, Home as HomeIcon, Mic, MicOff, Pencil, X, Check as CheckIcon, Trash2, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Button } from '@/components/ui/button';
import { useVoiceDictation } from "@/components/useVoiceDictation";
import { useTextToSpeech } from "@/components/useTextToSpeech";

interface Plan {
  id: number;
  text: string;
}

const initialPlans: Plan[] = [];

const PlansPage = () => {
  // Use the modular text-to-speech hook
  const { speakingId, speak, stop } = useTextToSpeech();
  function togglePlanSpeech(colId: string, planId: number, text: string) {
    const id = `${colId}-${planId}`;
    if (speakingId === id) {
      stop();
    } else {
      speak(id, text);
    }
  }
  // Delete a plan with confirmation
  function handleDeletePlan(colId: string, planId: number) {
    if (window.confirm('Are you sure you want to delete this plan?')) {
      setColumns(prev => {
        const updated = { ...prev };
        const col = updated[colId as keyof typeof prev];
        updated[colId as keyof typeof prev] = {
          ...col,
          items: col.items.filter(plan => plan.id !== planId)
        };
        return updated;
      });
      if (editing && editing.col === colId && editing.id === planId) {
        setEditing(null);
      }
    }
  }
  // Save the edited plan text
  function handleSaveEdit() {
    if (!editing) return;
    setColumns(prev => {
      const updated = { ...prev };
      const col = updated[editing.col as keyof typeof prev];
      updated[editing.col as keyof typeof prev] = {
        ...col,
        items: col.items.map(plan => plan.id === editing.id ? { ...plan, text: editing.text } : plan)
      };
      return updated;
    });
    setEditing(null);
  }
  const [editing, setEditing] = useState<{col: string, id: number, text: string} | null>(null);
  const [columns, setColumns] = useState({
    todo: { name: 'To Do', items: initialPlans },
    inProgress: { name: 'In Progress', items: [] as Plan[] },
    done: { name: 'Done', items: [] as Plan[] },
  });
  const {
    input,
    setInput,
    listening,
    toggleListening,
    browserSupportsSpeechRecognition
  } = useVoiceDictation('');

  const [idCounter, setIdCounter] = useState(1);

  const addPlan = () => {
    if (input.trim() === '') return;
    setColumns((prev) => ({
      ...prev,
      todo: {
        ...prev.todo,
        items: [...prev.todo.items, { id: idCounter, text: input }],
      },
    }));
    setIdCounter(idCounter + 1);
    setInput('');
  };

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    const sourceCol = columns[source.droppableId as keyof typeof columns];
    const destCol = columns[destination.droppableId as keyof typeof columns];
    const sourceItems = Array.from(sourceCol.items);
    const [removed] = sourceItems.splice(source.index, 1);
    if (source.droppableId === destination.droppableId) {
      sourceItems.splice(destination.index, 0, removed);
      setColumns({
        ...columns,
        [source.droppableId]: {
          ...sourceCol,
          items: sourceItems,
        },
      });
    } else {
      const destItems = Array.from(destCol.items);
      destItems.splice(destination.index, 0, removed);
      setColumns({
        ...columns,
        [source.droppableId]: {
          ...sourceCol,
          items: sourceItems,
        },
        [destination.droppableId]: {
          ...destCol,
          items: destItems,
        },
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary">
      {/* Navigation Bar */}
      <nav className="w-full border-b border-border bg-background/80 sticky top-0 z-10 backdrop-blur">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          {/* Logo and Brand */}
          <div className="flex items-center gap-2">
            <Bot className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold">AnalyticAI</span>
          </div>
          {/* Navigation Links */}
          <div className="flex gap-3 items-center">
            <Link href="/">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <HomeIcon className="h-4 w-4" /> Home
              </Button>
            </Link>
            <Link href="/chat">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Chat
              </Button>
            </Link>
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
            placeholder="Add a new plan..."
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
            Add
          </button>
        </div>
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(columns).map(([colId, col]) => (
              <div key={colId} className="bg-card rounded-lg p-4 min-h-[350px] shadow-sm flex flex-col">
                <h2 className="text-xl font-semibold text-center mb-4">{col.name}</h2>
                <Droppable droppableId={colId}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 space-y-4 transition-colors ${snapshot.isDraggingOver ? 'bg-secondary' : ''} p-1 rounded`}
                    >
                      {col.items.map((plan, idx) => (
                        <Draggable draggableId={plan.id.toString()} index={idx} key={plan.id}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`bg-white rounded shadow flex items-center gap-3 px-4 py-3 mb-2 ${snapshot.isDragging ? 'ring-2 ring-primary' : ''}`}
                            >
                              {/* Icon based on column */}
                              {colId === 'todo' && <ListTodo className="text-primary w-5 h-5 shrink-0" />}
                              {colId === 'inProgress' && <Loader2 className="text-yellow-500 animate-spin w-5 h-5 shrink-0" />}
                              {colId === 'done' && <CheckCircle2 className="text-green-600 w-5 h-5 shrink-0" />}
                              {editing && editing.col === colId && editing.id === plan.id ? (
                                <>
                                  <input
                                    className="border rounded px-2 py-1 text-base flex-1"
                                    value={editing.text}
                                    onChange={e => setEditing({...editing, text: e.target.value})}
                                    autoFocus
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleSaveEdit();
                                      if (e.key === 'Escape') setEditing(null);
                                    }}
                                  />
                                  <button className="ml-1 text-green-600 hover:text-green-800" onClick={handleSaveEdit} title="Save"><CheckIcon className="w-4 h-4" /></button>
                                  <button className="ml-1 text-red-500 hover:text-red-700" onClick={() => setEditing(null)} title="Cancel"><X className="w-4 h-4" /></button>
                                </>
                              ) : (
                                <>
                                  <span className={`ml-1 text-base ${colId === 'done' ? 'opacity-60 line-through' : ''}`}>{plan.text}</span>
                                  <button
                                    className={`ml-1 ${speakingId === `${colId}-${plan.id}` ? 'text-primary' : 'text-gray-400 hover:text-primary'}`}
                                    onClick={() => togglePlanSpeech(colId, plan.id, plan.text)}
                                    title={speakingId === `${colId}-${plan.id}` ? 'Stop speaking' : 'Speak plan'}
                                  >
                                    <Volume2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    className="ml-1 text-gray-400 hover:text-primary"
                                    onClick={() => setEditing({col: colId, id: plan.id, text: plan.text})}
                                    title="Edit plan"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    className="ml-1 text-red-400 hover:text-red-600"
                                    onClick={() => handleDeletePlan(colId, plan.id)}
                                    title="Delete plan"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
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

