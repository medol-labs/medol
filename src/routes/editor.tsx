import { createFileRoute } from '@tanstack/react-router';
import { EditorApp } from '../App';

export const Route = createFileRoute('/editor')({
  component: EditorApp
});
