import { createFileRoute } from '@tanstack/react-router';
import { PreviewApp } from '../App';

export const Route = createFileRoute('/preview')({
  component: PreviewApp
});
