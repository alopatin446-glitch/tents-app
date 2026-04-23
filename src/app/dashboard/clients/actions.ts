/**
 * Re-export серверных экшенов из канонического src/app/actions.ts.
 * KanbanBoard, EditModal, CreateClientModal импортируют отсюда.
 */
export {
  updateClientAction,
  deleteClientAction,
  createClientAction,
} from '@/app/actions';