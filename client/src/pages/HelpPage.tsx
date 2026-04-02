import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '@timeregistrering/shared';

interface Section {
  title: string;
  content: string[];
}

interface RoleContent {
  intro: string;
  sections: Section[];
}

const helpContent: Record<Role, RoleContent> = {
  ansatt: {
    intro: 'Her finner du hjelp til de vanligste oppgavene du gjør som ansatt.',
    sections: [
      {
        title: 'Stemple inn og ut',
        content: [
          'Gå til "Mine timer" i menyen.',
          'Trykk på den grønne "Stemple inn"-knappen for å starte en registrering.',
          'Når du er ferdig for dagen, trykk "Stemple ut". Appen beregner da arbeidstiden automatisk.',
          'Du kan også legge inn tid manuelt ved å trykke "+ Legg til" og fylle inn klokkeslett.',
        ],
      },
      {
        title: 'Redigere og slette timer',
        content: [
          'I timelisten kan du redigere en registrering ved å trykke på blyantikonet.',
          'Feil kan rettes opp så lenge registreringen har status "Kladd" eller "Avvist".',
          'Godkjente timer kan ikke endres av deg — ta kontakt med leder eller administrator.',
          'Du kan slette en kladd ved å trykke søppelbøtteikonet.',
        ],
      },
      {
        title: 'Sende inn timer for godkjenning',
        content: [
          'Når du er klar, trykker du "Send inn"-knappen øverst i timelisten.',
          'Alle ferdigstilte kladder (med både inn- og utstemplingstid) for perioden sendes til leder.',
          'Kladder uten utstemplingstid blir ikke sendt inn — fullfør dem først.',
          'Du kan velge å sende inn for gjeldende uke eller måned.',
        ],
      },
      {
        title: 'Fleksitid',
        content: [
          'Fleksitid beregnes automatisk basert på din arbeidsplan.',
          'Jobber du mer enn normalt, øker fleksisaldoen. Jobber du mindre, trekkes det fra.',
          'Du ser din fleksisaldo på hjemskjermen (dashbordet).',
          'Fleks trekkes automatisk dersom du søker om fravær med en fraværskode som er merket "trekker fra fleks".',
        ],
      },
      {
        title: 'Søke om fravær',
        content: [
          'Gå til "Mitt fravær" i menyen og trykk "Søk om fravær".',
          'Velg fraværstype (f.eks. egenmelding, ferie, sykt barn), periode og eventuelt antall timer per dag.',
          'Fraværstyper som krever godkjenning sendes til leder. Du får varsel når søknaden er behandlet.',
          'Fraværstyper uten godkjenningskrav godkjennes automatisk.',
          'Hvis en søknad avvises, kan du redigere den og sende inn på nytt.',
        ],
      },
      {
        title: 'Varsler',
        content: [
          'Klokkeikonet øverst til høyre viser antall uleste varsler.',
          'Du får varsel når timer godkjennes eller avvises, og når fraværssøknader behandles.',
          'Trykk på et varsel for å markere det som lest.',
        ],
      },
    ],
  },

  leder: {
    intro: 'Som leder godkjenner du timer og fravær for ditt team.',
    sections: [
      {
        title: 'Team-oversikt',
        content: [
          'Gå til "Team-oversikt" for å se en samlet status for teamet ditt.',
          'Du ser hvem som har innsendte timer som venter på godkjenning, og eventuelle AML-varsler.',
          'Klikk på en ansatts navn for å se en fullstendig, lesbar oversikt over vedkommendes timer, fravær og fleksisaldo.',
        ],
      },
      {
        title: 'Godkjenne timer',
        content: [
          'Gå til "Godkjenn timer" for å se alle innsendte timelister fra teamet ditt.',
          'Du kan godkjenne én og én rad, eller bruke "Godkjenn alle" for å behandle alt på en gang.',
          'For å avvise en registrering, trykk avvis-knappen og oppgi en begrunnelse — ansatte ser denne.',
          'Du kan ikke godkjenne dine egne timer.',
        ],
      },
      {
        title: 'Godkjenne fravær',
        content: [
          'Gå til "Godkjenn fravær" for å behandle fraværssøknader fra teamet.',
          'Du ser fraværstype, periode og eventuell kommentar fra den ansatte.',
          'Ved avvisning oppgir du en begrunnelse. Den ansatte kan deretter redigere og sende inn på nytt.',
          'Du kan ikke godkjenne dine egne fraværssøknader.',
        ],
      },
      {
        title: 'AML-overvåking',
        content: [
          'AML (Arbeidsmiljøloven) regler overvåkes automatisk.',
          'Du får varsel i team-oversikten dersom en ansatt nærmer seg eller overskrider grenser for daglig/ukentlig arbeidstid eller hviletid.',
        ],
      },
    ],
  },

  fagleder: {
    intro: 'Som fagleder har du tilgang til team-oversikt og kan følge opp timeregistrering.',
    sections: [
      {
        title: 'Team-oversikt',
        content: [
          'Gå til "Team-oversikt" for å se status for teamet ditt.',
          'Du ser innsendte timer som venter på behandling og eventuelle AML-varsler.',
        ],
      },
      {
        title: 'Egne registreringer',
        content: [
          'Du bruker timeregistrering på samme måte som en ansatt.',
          'Se hjelpen for "Ansatt" for detaljer om inn-/utstempeling, fravær og innsending.',
        ],
      },
    ],
  },

  admin: {
    intro: 'Som administrator administrerer du hele systemet — brukere, strukturer og regler.',
    sections: [
      {
        title: 'Brukere',
        content: [
          'Gå til "Admin → Brukere" for å opprette, redigere og deaktivere brukere.',
          'Angi ansattnummer, navn, e-post, rolle, avdeling og gruppe ved opprettelse.',
          'En bruker kan ha én primærrolle, men kan ha tilgang til flere roller (f.eks. ansatt + leder).',
        ],
      },
      {
        title: 'Avdelinger og grupper',
        content: [
          'Avdelinger er toppnivå-enheter. Grupper er underenheter innenfor en avdeling.',
          'Opprett avdelinger under "Admin → Avdelinger" og grupper under "Admin → Grupper".',
          'Ansatte knyttes til avdeling/gruppe ved opprettelse eller redigering av brukerprofil.',
        ],
      },
      {
        title: 'Arbeidsplaner',
        content: [
          'Arbeidsplaner definerer normalarbeidstid per ukedag.',
          'Gå til "Admin → Arbeidsplaner" for å opprette planer og tildele dem til ansatte.',
          'En plan tildeles med en startdato — systemet bruker gjeldende plan for å beregne fleksitid.',
        ],
      },
      {
        title: 'Fraværskoder',
        content: [
          'Fraværskoder styrer hvilke fraværstyper ansatte kan velge fra.',
          'For hver kode kan du angi om den krever godkjenning, trekker fra fleks eller ferie.',
          'Deaktiverte koder er ikke synlige for ansatte, men bevares i historikken.',
        ],
      },
      {
        title: 'AML-regler',
        content: [
          'AML-regler definerer grenser for arbeidstid iht. Arbeidsmiljøloven.',
          'Gå til "Admin → AML-regler" for å justere terskelverdier (maks dag/uke, hviletid osv.).',
          'Brudd varsles automatisk til leder og vises i team-oversikten.',
        ],
      },
      {
        title: 'Lønnseksport',
        content: [
          'Gå til "Lønnseksport" for å eksportere godkjente timer for en gitt periode.',
          'Du kan filtrere på avdeling og datoperiode.',
          'Eksporten inneholder godkjente timer per ansatt, klar for import i lønnssystem.',
        ],
      },
    ],
  },

  lonningsansvarlig: {
    intro: 'Som lønningsansvarlig eksporterer du godkjente timer til lønnssystemet.',
    sections: [
      {
        title: 'Lønnseksport',
        content: [
          'Gå til "Lønnseksport" i menyen.',
          'Velg ønsket periode og eventuelt avdeling.',
          'Kun godkjente timer inkluderes i eksporten.',
          'Last ned filen og importer den i lønnssystemet.',
        ],
      },
      {
        title: 'Forutsetninger',
        content: [
          'Timer må være godkjent av leder før de er tilgjengelige for lønnseksport.',
          'Kontakt administrator dersom godkjente timer mangler eller virker feil.',
        ],
      },
    ],
  },
};

function AccordionSection({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left bg-white hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-medium text-gray-900 text-sm">{section.title}</span>
        {open
          ? <ChevronUpIcon className="h-4 w-4 text-gray-500 shrink-0" />
          : <ChevronDownIcon className="h-4 w-4 text-gray-500 shrink-0" />
        }
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 bg-white border-t border-gray-100">
          <ol className="space-y-2">
            {section.content.map((line, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-gray-600">
                <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-semibold mt-0.5">
                  {i + 1}
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

const roleLabels: Record<Role, string> = {
  ansatt: 'Ansatt',
  leder: 'Leder',
  fagleder: 'Fagleder',
  admin: 'Administrator',
  lonningsansvarlig: 'Lønningsansvarlig',
};

export function HelpPage() {
  const { activeRole } = useAuth();
  const role = (activeRole ?? 'ansatt') as Role;
  const content = helpContent[role];

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
              {roleLabels[role]}
            </span>
            <span className="text-xs text-gray-400">Innholdet er tilpasset din rolle</span>
          </div>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-gray-600 mb-4">{content.intro}</p>
          <div className="space-y-2">
            {content.sections.map((section) => (
              <AccordionSection key={section.title} section={section} />
            ))}
          </div>
        </CardBody>
      </Card>

      <p className="text-xs text-center text-gray-400 pb-2">
        Ser du noe som er feil eller mangler? Ta kontakt med administrator.
      </p>
    </div>
  );
}
