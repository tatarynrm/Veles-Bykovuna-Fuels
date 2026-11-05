import { redirect } from 'next/navigation';

/** Старе посилання /workflow/bank/privat24 веде на виписку рахунків. */
export default function BankPrivat24Index() {
  redirect('/workflow/bank/privat24/transactions');
}
