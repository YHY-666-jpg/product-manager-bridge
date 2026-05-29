import { useTodos } from "./todoStore";

export function App() {
  const { todos, addTodo, toggleTodo } = useTodos();
  return (
    <main>
      <h1>Todo App</h1>
      <button onClick={() => addTodo("New todo")}>Add</button>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            <label>
              <input type="checkbox" checked={todo.done} onChange={() => toggleTodo(todo.id)} />
              {todo.title}
            </label>
          </li>
        ))}
      </ul>
    </main>
  );
}
