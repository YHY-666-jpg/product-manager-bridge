import { useState } from "react";

export interface Todo {
  id: string;
  title: string;
  done: boolean;
}

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  return {
    todos,
    addTodo(title: string) {
      setTodos((current) => [...current, { id: crypto.randomUUID(), title, done: false }]);
    },
    toggleTodo(id: string) {
      setTodos((current) => current.map((todo) => todo.id === id ? { ...todo, done: !todo.done } : todo));
    }
  };
}
