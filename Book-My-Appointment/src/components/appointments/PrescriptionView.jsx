export default function PrescriptionView({ consultation }) {
  const { notes, prescription } = consultation
  return (
    <div className="space-y-6">
      <section aria-labelledby="notes-heading">
        <h2 id="notes-heading" className="text-lg font-semibold text-ink-900">
          Consultation notes
        </h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-ink-700">{notes || 'No notes were recorded for this visit.'}</p>
      </section>
      <section aria-labelledby="rx-heading">
        <h2 id="rx-heading" className="text-lg font-semibold text-ink-900">
          Prescription
        </h2>
        {prescription.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">No medicines were prescribed.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="border-b border-slate-300 text-xs uppercase text-ink-500">
                <tr>
                  <th className="py-2 pr-3">Medicine</th>
                  <th className="py-2 pr-3">Dosage</th>
                  <th className="py-2 pr-3">Frequency</th>
                  <th className="py-2 pr-3">Days</th>
                  <th className="py-2">Instructions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prescription.map((item, index) => (
                  <tr key={`${item.medicine}-${index}`}>
                    <th scope="row" className="py-2 pr-3 font-medium">
                      {item.medicine}
                    </th>
                    <td className="py-2 pr-3">{item.dosage}</td>
                    <td className="py-2 pr-3">{item.frequency}</td>
                    <td className="py-2 pr-3">{item.durationDays}</td>
                    <td className="py-2">{item.instructions || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
