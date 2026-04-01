import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { AmlRule } from '@timeregistrering/shared';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { toast } from 'sonner';

// Tomme strenger i skjema, null ved lagring hvis tomt
type AmlForm = {
  max_hours_per_day: string;
  max_hours_per_week: string;
  max_hours_per_year: string;
  avg_max_hours_per_day: string;
  avg_max_hours_per_week: string;
  avg_calculation_weeks: string;
  min_daily_rest_hours: string;
  min_weekly_rest_hours: string;
};

const emptyForm: AmlForm = {
  max_hours_per_day: '',
  max_hours_per_week: '',
  max_hours_per_year: '',
  avg_max_hours_per_day: '',
  avg_max_hours_per_week: '',
  avg_calculation_weeks: '',
  min_daily_rest_hours: '',
  min_weekly_rest_hours: '',
};

function ruleToForm(rule: AmlRule): AmlForm {
  return {
    max_hours_per_day:      rule.max_hours_per_day?.toString()      ?? '',
    max_hours_per_week:     rule.max_hours_per_week?.toString()     ?? '',
    max_hours_per_year:     rule.max_hours_per_year?.toString()     ?? '',
    avg_max_hours_per_day:  rule.avg_max_hours_per_day?.toString()  ?? '',
    avg_max_hours_per_week: rule.avg_max_hours_per_week?.toString() ?? '',
    avg_calculation_weeks:  rule.avg_calculation_weeks?.toString()  ?? '',
    min_daily_rest_hours:   rule.min_daily_rest_hours?.toString()   ?? '',
    min_weekly_rest_hours:  rule.min_weekly_rest_hours?.toString()  ?? '',
  };
}

function formToPayload(f: AmlForm) {
  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  const int = (v: string) => (v.trim() === '' ? null : Math.round(Number(v)));
  return {
    max_hours_per_day:      num(f.max_hours_per_day),
    max_hours_per_week:     num(f.max_hours_per_week),
    max_hours_per_year:     num(f.max_hours_per_year),
    avg_max_hours_per_day:  num(f.avg_max_hours_per_day),
    avg_max_hours_per_week: num(f.avg_max_hours_per_week),
    avg_calculation_weeks:  int(f.avg_calculation_weeks),
    min_daily_rest_hours:   num(f.min_daily_rest_hours),
    min_weekly_rest_hours:  num(f.min_weekly_rest_hours),
  };
}

function FieldGroup({ title, description, children }: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-gray-100 pb-6 last:border-0 last:pb-0">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  );
}

function NumberInput({
  label, id, value, onChange, placeholder, hint,
}: {
  label: string; id: string; value: string;
  onChange: (v: string) => void; placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        <span className="ml-1 text-xs font-normal text-gray-400">(valgfri)</span>
      </label>
      <input
        id={id}
        type="number"
        min="0"
        step="0.5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Ikke satt'}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export function AmlRulesPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<AmlForm>(emptyForm);

  const { data: rules, isLoading } = useQuery({
    queryKey: ['aml-rules'],
    queryFn: () => apiFetch<AmlRule | null>('/aml/rules'),
  });

  // Fyll skjema når eksisterende regler lastes inn
  useEffect(() => {
    if (rules) setForm(ruleToForm(rules));
  }, [rules]);

  const save = useMutation({
    mutationFn: (body: object) =>
      apiFetch<AmlRule>('/aml/rules', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aml-rules'] });
      toast.success('AML-regler lagret');
    },
    onError: () => toast.error('Kunne ikke lagre AML-regler'),
  });

  const f = (field: keyof AmlForm) => (v: string) => setForm((prev) => ({ ...prev, [field]: v }));

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-semibold text-gray-800">AML-regler</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Globale grenser etter arbeidsmiljøloven. La felt stå tomme for å deaktivere regelen.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-gray-700">Maksimal arbeidstid</h3>
        </CardHeader>
        <CardBody className="space-y-6">
          <FieldGroup
            title="Absolutte grenser"
            description="Maksimalt antall timer registrert i perioden."
          >
            <NumberInput
              label="Maks timer per dag" id="maxDay"
              value={form.max_hours_per_day} onChange={f('max_hours_per_day')}
              placeholder="F.eks. 10" hint="AML § 10-8: normalt 9 t, med avtale inntil 13 t"
            />
            <NumberInput
              label="Maks timer per uke" id="maxWeek"
              value={form.max_hours_per_week} onChange={f('max_hours_per_week')}
              placeholder="F.eks. 48" hint="AML § 10-6: inntil 48 t inkl. overtid per 7 dager"
            />
            <NumberInput
              label="Maks timer per år" id="maxYear"
              value={form.max_hours_per_year} onChange={f('max_hours_per_year')}
              placeholder="F.eks. 2000"
            />
          </FieldGroup>

          <FieldGroup
            title="Gjennomsnittsberegning (§ 10-5)"
            description="Gjennomsnittlig arbeidstid over et rullerende vindu. Beregnes mot kalenderarbeidsdager (Man–Fre ekskl. helligdager)."
          >
            <NumberInput
              label="Maks gjennomsnitt per dag" id="avgDay"
              value={form.avg_max_hours_per_day} onChange={f('avg_max_hours_per_day')}
              placeholder="F.eks. 9"
            />
            <NumberInput
              label="Maks gjennomsnitt per uke" id="avgWeek"
              value={form.avg_max_hours_per_week} onChange={f('avg_max_hours_per_week')}
              placeholder="F.eks. 48" hint="48 t / uke gjennomsnittsberegnet over perioden"
            />
            <div className="sm:col-span-2">
              <NumberInput
                label="Beregningsperiode (uker)" id="avgCalcWeeks"
                value={form.avg_calculation_weeks} onChange={f('avg_calculation_weeks')}
                placeholder="F.eks. 8" hint="Antall uker i det rullerende vinduet (f.eks. 8 uker etter § 10-5)"
              />
            </div>
          </FieldGroup>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-gray-700">Minimumshvile</h3>
        </CardHeader>
        <CardBody>
          <FieldGroup
            title="Hviletidsgrenser"
            description="Minimum sammenhengende hviletid mellom arbeidsdager og per uke."
          >
            <NumberInput
              label="Min. daglig hviletid (timer)" id="restDaily"
              value={form.min_daily_rest_hours} onChange={f('min_daily_rest_hours')}
              placeholder="F.eks. 11" hint="AML § 10-8: minimum 11 t mellom arbeidsdager"
            />
            <NumberInput
              label="Min. ukentlig hviletid (timer)" id="restWeekly"
              value={form.min_weekly_rest_hours} onChange={f('min_weekly_rest_hours')}
              placeholder="F.eks. 35" hint="AML § 10-8: minimum 35 t sammenhengende per 7 dager"
            />
          </FieldGroup>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button loading={save.isPending} onClick={() => save.mutate(formToPayload(form))}>
          Lagre AML-regler
        </Button>
      </div>
    </div>
  );
}
