import type { Metadata } from "next";
import Link from "next/link";
import {
  Alert,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { canSeeAction } from "@/lib/auth/ui-visibility";
import { formatNpwpDisplay } from "@/lib/client/profile";
import { getAuthenticatedSession } from "@/server/auth/session";
import { listClients } from "@/server/client/management";
import { AddClientForm } from "./add-client-form";

export const metadata: Metadata = {
  title: "Client",
};

export default async function ClientsPage() {
  const session = await getAuthenticatedSession();
  if (!session) {
    return <Alert tone="danger">Sesi berakhir. Silakan masuk kembali.</Alert>;
  }

  const now = new Date();
  const listed = await listClients(session.actor, now);
  if (!listed.ok) {
    return <Alert tone="danger">{listed.reason}</Alert>;
  }

  const bolehKelola = canSeeAction(session.actor, "client.manage", now);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="text-slate-500 text-xs">
          <Link href="/beranda" className="underline-offset-4 hover:underline">
            Beranda
          </Link>
          {" / "}
          Client
        </p>
        <h1 className="text-xl">Master data client</h1>
        <p className="max-w-prose text-slate-500">
          Client diisi sekali di sini, lalu dipilih saat mendaftarkan project.
          Jangan ketik nama yang sama berulang di formulir project.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base">Daftar client</h2>
        {listed.clients.length === 0 ? (
          <p className="rounded-card border border-line bg-white px-4 py-3 text-slate-500 text-sm">
            Belum ada client di master data.
            {bolehKelola
              ? " Isi formulir di bawah untuk yang pertama."
              : " Minta COO atau Officer Operational menambahkannya."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Kontak</TableHead>
                <TableHead>Alamat</TableHead>
                <TableHead>NPWP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listed.clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <span className="font-medium text-plum-900">
                      {client.name}
                    </span>
                  </TableCell>
                  <TableCell>{client.contact ?? "—"}</TableCell>
                  <TableCell>{client.address ?? "—"}</TableCell>
                  <TableCell className="angka text-xs">
                    {formatNpwpDisplay(client.npwp)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {bolehKelola ? (
        <section className="flex max-w-xl flex-col gap-3 rounded-card border border-line bg-white p-5">
          <h2 className="text-base">Tambah client</h2>
          <p className="text-slate-500 text-sm">
            Nama wajib. Kontak, alamat, dan NPWP boleh kosong. Nama tidak boleh
            bentrok dengan yang sudah tersimpan.
          </p>
          <AddClientForm />
        </section>
      ) : (
        <Alert tone="status">
          Formulir penambahan hanya untuk COO, Vice COO, atau Officer
          Operational. Anda masih bisa melihat daftar ini untuk memilih client
          saat mendaftarkan project.
        </Alert>
      )}
    </div>
  );
}
