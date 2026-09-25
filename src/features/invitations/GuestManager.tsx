'use client';

import { useState } from 'react';
import { InviteForm } from './InviteForm';
import { GuestTable } from './GuestTable';

export function GuestManager() {
  const [reloadTrigger, setReloadTrigger] = useState(0);

  return (
    <>
      <InviteForm onCreated={() => setReloadTrigger((prev) => prev + 1)} />
      <GuestTable
        reloadTrigger={reloadTrigger}
      />
    </>
  );
}
