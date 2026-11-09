import { requireUser } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { PasswordForm, ProfileForm } from './forms';

export const metadata = { title: 'Settings' };

export default async function Settings() {
  const u = await requireUser();
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid max-w-3xl gap-6">
        <section className="card p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold">Profile</h2>
          <ProfileForm username={u.username} email={u.email} roblox={u.roblox_username ?? ''} avatar={u.avatar} />
        </section>
        <section className="card p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold">Password</h2>
          <PasswordForm />
        </section>
      </div>
    </>
  );
}
