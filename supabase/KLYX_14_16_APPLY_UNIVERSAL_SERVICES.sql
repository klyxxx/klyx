-- ============================================================
-- KLYX 14.16 - UNIVERSAL SERVICES SAFE APPLY
-- Ajouter uniquement les services absents.
-- KLYX_UNIVERSAL_SAFE_APPLY_14_16
-- ============================================================

begin;

do $klyx$
begin
  if to_regclass('public.services') is null then
    raise exception 'KLYX_SERVICES_TABLE_MISSING';
  end if;
end
$klyx$;

insert into public.services (name, slug)
select 'Abattage d''arbre', 'abattage-d-arbre'
where not exists (
  select 1
  from public.services
  where slug = 'abattage-d-arbre'
);

insert into public.services (name, slug)
select 'Accompagnateur touristique', 'accompagnateur-touristique'
where not exists (
  select 1
  from public.services
  where slug = 'accompagnateur-touristique'
);

insert into public.services (name, slug)
select 'Accompagnement aux rendez-vous', 'accompagnement-aux-rendez-vous'
where not exists (
  select 1
  from public.services
  where slug = 'accompagnement-aux-rendez-vous'
);

insert into public.services (name, slug)
select 'Accompagnement familial', 'accompagnement-familial'
where not exists (
  select 1
  from public.services
  where slug = 'accompagnement-familial'
);

insert into public.services (name, slug)
select 'Accompagnement scolaire', 'accompagnement-scolaire'
where not exists (
  select 1
  from public.services
  where slug = 'accompagnement-scolaire'
);

insert into public.services (name, slug)
select 'Accueil voyageurs', 'accueil-voyageurs'
where not exists (
  select 1
  from public.services
  where slug = 'accueil-voyageurs'
);

insert into public.services (name, slug)
select 'Administration système', 'administration-systeme'
where not exists (
  select 1
  from public.services
  where slug = 'administration-systeme'
);

insert into public.services (name, slug)
select 'Agent de sécurité', 'agent-de-securite'
where not exists (
  select 1
  from public.services
  where slug = 'agent-de-securite'
);

insert into public.services (name, slug)
select 'Aide administrative à domicile', 'aide-administrative-a-domicile'
where not exists (
  select 1
  from public.services
  where slug = 'aide-administrative-a-domicile'
);

insert into public.services (name, slug)
select 'Aide à domicile', 'aide-a-domicile'
where not exists (
  select 1
  from public.services
  where slug = 'aide-a-domicile'
);

insert into public.services (name, slug)
select 'Aide agricole', 'aide-agricole'
where not exists (
  select 1
  from public.services
  where slug = 'aide-agricole'
);

insert into public.services (name, slug)
select 'Aide à la mobilité', 'aide-a-la-mobilite'
where not exists (
  select 1
  from public.services
  where slug = 'aide-a-la-mobilite'
);

insert into public.services (name, slug)
select 'Aide au déménagement', 'aide-au-demenagement'
where not exists (
  select 1
  from public.services
  where slug = 'aide-au-demenagement'
);

insert into public.services (name, slug)
select 'Aide aux démarches administratives', 'aide-aux-demarches-administratives'
where not exists (
  select 1
  from public.services
  where slug = 'aide-aux-demarches-administratives'
);

insert into public.services (name, slug)
select 'Aide aux devoirs', 'aide-aux-devoirs'
where not exists (
  select 1
  from public.services
  where slug = 'aide-aux-devoirs'
);

insert into public.services (name, slug)
select 'Aide comptable', 'aide-comptable'
where not exists (
  select 1
  from public.services
  where slug = 'aide-comptable'
);

insert into public.services (name, slug)
select 'Aide-cuisinier', 'aide-cuisinier'
where not exists (
  select 1
  from public.services
  where slug = 'aide-cuisinier'
);

insert into public.services (name, slug)
select 'Aide logistique', 'aide-logistique'
where not exists (
  select 1
  from public.services
  where slug = 'aide-logistique'
);

insert into public.services (name, slug)
select 'Aide ménagère', 'aide-menagere'
where not exists (
  select 1
  from public.services
  where slug = 'aide-menagere'
);

insert into public.services (name, slug)
select 'Alphabétisation', 'alphabetisation'
where not exists (
  select 1
  from public.services
  where slug = 'alphabetisation'
);

insert into public.services (name, slug)
select 'Aménagement de jardin', 'amenagement-de-jardin'
where not exists (
  select 1
  from public.services
  where slug = 'amenagement-de-jardin'
);

insert into public.services (name, slug)
select 'Animateur', 'animateur'
where not exists (
  select 1
  from public.services
  where slug = 'animateur'
);

insert into public.services (name, slug)
select 'Animation 2D', 'animation-2d'
where not exists (
  select 1
  from public.services
  where slug = 'animation-2d'
);

insert into public.services (name, slug)
select 'Animation 3D', 'animation-3d'
where not exists (
  select 1
  from public.services
  where slug = 'animation-3d'
);

insert into public.services (name, slug)
select 'Animation enfants', 'animation-enfants'
where not exists (
  select 1
  from public.services
  where slug = 'animation-enfants'
);

insert into public.services (name, slug)
select 'Apiculture', 'apiculture'
where not exists (
  select 1
  from public.services
  where slug = 'apiculture'
);

insert into public.services (name, slug)
select 'Aquariophilie', 'aquariophilie'
where not exists (
  select 1
  from public.services
  where slug = 'aquariophilie'
);

insert into public.services (name, slug)
select 'Architecte', 'architecte'
where not exists (
  select 1
  from public.services
  where slug = 'architecte'
);

insert into public.services (name, slug)
select 'Architecte d''intérieur', 'architecte-d-interieur'
where not exists (
  select 1
  from public.services
  where slug = 'architecte-d-interieur'
);

insert into public.services (name, slug)
select 'Architecture intérieure', 'architecture-interieure'
where not exists (
  select 1
  from public.services
  where slug = 'architecture-interieure'
);

insert into public.services (name, slug)
select 'Arrosage automatique', 'arrosage-automatique'
where not exists (
  select 1
  from public.services
  where slug = 'arrosage-automatique'
);

insert into public.services (name, slug)
select 'Assistance quotidienne', 'assistance-quotidienne'
where not exists (
  select 1
  from public.services
  where slug = 'assistance-quotidienne'
);

insert into public.services (name, slug)
select 'Assistant administratif', 'assistant-administratif'
where not exists (
  select 1
  from public.services
  where slug = 'assistant-administratif'
);

insert into public.services (name, slug)
select 'Assistant virtuel', 'assistant-virtuel'
where not exists (
  select 1
  from public.services
  where slug = 'assistant-virtuel'
);

insert into public.services (name, slug)
select 'Audit énergétique', 'audit-energetique'
where not exists (
  select 1
  from public.services
  where slug = 'audit-energetique'
);

insert into public.services (name, slug)
select 'Auditeur', 'auditeur'
where not exists (
  select 1
  from public.services
  where slug = 'auditeur'
);

insert into public.services (name, slug)
select 'Automatisation', 'automatisation'
where not exists (
  select 1
  from public.services
  where slug = 'automatisation'
);

insert into public.services (name, slug)
select 'Autre métier ou prestation', 'autre-metier-ou-prestation'
where not exists (
  select 1
  from public.services
  where slug = 'autre-metier-ou-prestation'
);

insert into public.services (name, slug)
select 'Autre service à domicile', 'autre-service-a-domicile'
where not exists (
  select 1
  from public.services
  where slug = 'autre-service-a-domicile'
);

insert into public.services (name, slug)
select 'Autre service créatif', 'autre-service-creatif'
where not exists (
  select 1
  from public.services
  where slug = 'autre-service-creatif'
);

insert into public.services (name, slug)
select 'Autre service de transport', 'autre-service-de-transport'
where not exists (
  select 1
  from public.services
  where slug = 'autre-service-de-transport'
);

insert into public.services (name, slug)
select 'Autre service événementiel', 'autre-service-evenementiel'
where not exists (
  select 1
  from public.services
  where slug = 'autre-service-evenementiel'
);

insert into public.services (name, slug)
select 'Autre service professionnel', 'autre-service-professionnel'
where not exists (
  select 1
  from public.services
  where slug = 'autre-service-professionnel'
);

insert into public.services (name, slug)
select 'Autre service technique', 'autre-service-technique'
where not exists (
  select 1
  from public.services
  where slug = 'autre-service-technique'
);

insert into public.services (name, slug)
select 'Baby-sitting', 'baby-sitting'
where not exists (
  select 1
  from public.services
  where slug = 'baby-sitting'
);

insert into public.services (name, slug)
select 'Bagagerie', 'bagagerie'
where not exists (
  select 1
  from public.services
  where slug = 'bagagerie'
);

insert into public.services (name, slug)
select 'Barbecue à domicile', 'barbecue-a-domicile'
where not exists (
  select 1
  from public.services
  where slug = 'barbecue-a-domicile'
);

insert into public.services (name, slug)
select 'Barbier', 'barbier'
where not exists (
  select 1
  from public.services
  where slug = 'barbier'
);

insert into public.services (name, slug)
select 'Barista', 'barista'
where not exists (
  select 1
  from public.services
  where slug = 'barista'
);

insert into public.services (name, slug)
select 'Barman', 'barman'
where not exists (
  select 1
  from public.services
  where slug = 'barman'
);

insert into public.services (name, slug)
select 'Barman événementiel', 'barman-evenementiel'
where not exists (
  select 1
  from public.services
  where slug = 'barman-evenementiel'
);

insert into public.services (name, slug)
select 'Batterie automobile', 'batterie-automobile'
where not exists (
  select 1
  from public.services
  where slug = 'batterie-automobile'
);

insert into public.services (name, slug)
select 'Batterie domestique', 'batterie-domestique'
where not exists (
  select 1
  from public.services
  where slug = 'batterie-domestique'
);

insert into public.services (name, slug)
select 'Blanchisserie', 'blanchisserie'
where not exists (
  select 1
  from public.services
  where slug = 'blanchisserie'
);

insert into public.services (name, slug)
select 'Boulanger', 'boulanger'
where not exists (
  select 1
  from public.services
  where slug = 'boulanger'
);

insert into public.services (name, slug)
select 'Branding', 'branding'
where not exists (
  select 1
  from public.services
  where slug = 'branding'
);

insert into public.services (name, slug)
select 'Bricolage général', 'bricolage-general'
where not exists (
  select 1
  from public.services
  where slug = 'bricolage-general'
);

insert into public.services (name, slug)
select 'Broderie', 'broderie'
where not exists (
  select 1
  from public.services
  where slug = 'broderie'
);

insert into public.services (name, slug)
select 'Bûcheronnage', 'bucheronnage'
where not exists (
  select 1
  from public.services
  where slug = 'bucheronnage'
);

insert into public.services (name, slug)
select 'Buffet événementiel', 'buffet-evenementiel'
where not exists (
  select 1
  from public.services
  where slug = 'buffet-evenementiel'
);

insert into public.services (name, slug)
select 'Business plan', 'business-plan'
where not exists (
  select 1
  from public.services
  where slug = 'business-plan'
);

insert into public.services (name, slug)
select 'Cake designer', 'cake-designer'
where not exists (
  select 1
  from public.services
  where slug = 'cake-designer'
);

insert into public.services (name, slug)
select 'Cariste', 'cariste'
where not exists (
  select 1
  from public.services
  where slug = 'cariste'
);

insert into public.services (name, slug)
select 'Carrelage', 'carrelage'
where not exists (
  select 1
  from public.services
  where slug = 'carrelage'
);

insert into public.services (name, slug)
select 'Carrosserie', 'carrosserie'
where not exists (
  select 1
  from public.services
  where slug = 'carrosserie'
);

insert into public.services (name, slug)
select 'Chanteur', 'chanteur'
where not exists (
  select 1
  from public.services
  where slug = 'chanteur'
);

insert into public.services (name, slug)
select 'Chape', 'chape'
where not exists (
  select 1
  from public.services
  where slug = 'chape'
);

insert into public.services (name, slug)
select 'Charpente', 'charpente'
where not exists (
  select 1
  from public.services
  where slug = 'charpente'
);

insert into public.services (name, slug)
select 'Chauffagiste', 'chauffagiste'
where not exists (
  select 1
  from public.services
  where slug = 'chauffagiste'
);

insert into public.services (name, slug)
select 'Check-in location', 'check-in-location'
where not exists (
  select 1
  from public.services
  where slug = 'check-in-location'
);

insert into public.services (name, slug)
select 'Check-out location', 'check-out-location'
where not exists (
  select 1
  from public.services
  where slug = 'check-out-location'
);

insert into public.services (name, slug)
select 'Chef à domicile', 'chef-a-domicile'
where not exists (
  select 1
  from public.services
  where slug = 'chef-a-domicile'
);

insert into public.services (name, slug)
select 'Classement de documents', 'classement-de-documents'
where not exists (
  select 1
  from public.services
  where slug = 'classement-de-documents'
);

insert into public.services (name, slug)
select 'Climatisation', 'climatisation'
where not exists (
  select 1
  from public.services
  where slug = 'climatisation'
);

insert into public.services (name, slug)
select 'Cloud', 'cloud'
where not exists (
  select 1
  from public.services
  where slug = 'cloud'
);

insert into public.services (name, slug)
select 'Coach basketball', 'coach-basketball'
where not exists (
  select 1
  from public.services
  where slug = 'coach-basketball'
);

insert into public.services (name, slug)
select 'Coach carrière', 'coach-carriere'
where not exists (
  select 1
  from public.services
  where slug = 'coach-carriere'
);

insert into public.services (name, slug)
select 'Coach fitness', 'coach-fitness'
where not exists (
  select 1
  from public.services
  where slug = 'coach-fitness'
);

insert into public.services (name, slug)
select 'Coach football', 'coach-football'
where not exists (
  select 1
  from public.services
  where slug = 'coach-football'
);

insert into public.services (name, slug)
select 'Coach musculation', 'coach-musculation'
where not exists (
  select 1
  from public.services
  where slug = 'coach-musculation'
);

insert into public.services (name, slug)
select 'Coach natation', 'coach-natation'
where not exists (
  select 1
  from public.services
  where slug = 'coach-natation'
);

insert into public.services (name, slug)
select 'Coach professionnel', 'coach-professionnel'
where not exists (
  select 1
  from public.services
  where slug = 'coach-professionnel'
);

insert into public.services (name, slug)
select 'Coach running', 'coach-running'
where not exists (
  select 1
  from public.services
  where slug = 'coach-running'
);

insert into public.services (name, slug)
select 'Coach sportif', 'coach-sportif'
where not exists (
  select 1
  from public.services
  where slug = 'coach-sportif'
);

insert into public.services (name, slug)
select 'Coach tennis', 'coach-tennis'
where not exists (
  select 1
  from public.services
  where slug = 'coach-tennis'
);

insert into public.services (name, slug)
select 'Coiffeur', 'coiffeur'
where not exists (
  select 1
  from public.services
  where slug = 'coiffeur'
);

insert into public.services (name, slug)
select 'Coiffeur à domicile', 'coiffeur-a-domicile'
where not exists (
  select 1
  from public.services
  where slug = 'coiffeur-a-domicile'
);

insert into public.services (name, slug)
select 'Communication', 'communication'
where not exists (
  select 1
  from public.services
  where slug = 'communication'
);

insert into public.services (name, slug)
select 'Community manager', 'community-manager'
where not exists (
  select 1
  from public.services
  where slug = 'community-manager'
);

insert into public.services (name, slug)
select 'Compagnie pour personne âgée', 'compagnie-pour-personne-agee'
where not exists (
  select 1
  from public.services
  where slug = 'compagnie-pour-personne-agee'
);

insert into public.services (name, slug)
select 'Comportementaliste animalier', 'comportementaliste-animalier'
where not exists (
  select 1
  from public.services
  where slug = 'comportementaliste-animalier'
);

insert into public.services (name, slug)
select 'Comptable', 'comptable'
where not exists (
  select 1
  from public.services
  where slug = 'comptable'
);

insert into public.services (name, slug)
select 'Conciergerie', 'conciergerie'
where not exists (
  select 1
  from public.services
  where slug = 'conciergerie'
);

insert into public.services (name, slug)
select 'Conciergerie locative', 'conciergerie-locative'
where not exists (
  select 1
  from public.services
  where slug = 'conciergerie-locative'
);

insert into public.services (name, slug)
select 'Conciergerie voyage', 'conciergerie-voyage'
where not exists (
  select 1
  from public.services
  where slug = 'conciergerie-voyage'
);

insert into public.services (name, slug)
select 'Configuration Wi-Fi', 'configuration-wi-fi'
where not exists (
  select 1
  from public.services
  where slug = 'configuration-wi-fi'
);

insert into public.services (name, slug)
select 'Conseil budgétaire', 'conseil-budgetaire'
where not exists (
  select 1
  from public.services
  where slug = 'conseil-budgetaire'
);

insert into public.services (name, slug)
select 'Conseil commercial', 'conseil-commercial'
where not exists (
  select 1
  from public.services
  where slug = 'conseil-commercial'
);

insert into public.services (name, slug)
select 'Conseil en entreprise', 'conseil-en-entreprise'
where not exists (
  select 1
  from public.services
  where slug = 'conseil-en-entreprise'
);

insert into public.services (name, slug)
select 'Conseil en image', 'conseil-en-image'
where not exists (
  select 1
  from public.services
  where slug = 'conseil-en-image'
);

insert into public.services (name, slug)
select 'Consultant', 'consultant'
where not exists (
  select 1
  from public.services
  where slug = 'consultant'
);

insert into public.services (name, slug)
select 'Contrôle d''accès', 'controle-d-acces'
where not exists (
  select 1
  from public.services
  where slug = 'controle-d-acces'
);

insert into public.services (name, slug)
select 'Coordinateur de mariage', 'coordinateur-de-mariage'
where not exists (
  select 1
  from public.services
  where slug = 'coordinateur-de-mariage'
);

insert into public.services (name, slug)
select 'Copywriting', 'copywriting'
where not exists (
  select 1
  from public.services
  where slug = 'copywriting'
);

insert into public.services (name, slug)
select 'Cordonnier', 'cordonnier'
where not exists (
  select 1
  from public.services
  where slug = 'cordonnier'
);

insert into public.services (name, slug)
select 'Correction de texte', 'correction-de-texte'
where not exists (
  select 1
  from public.services
  where slug = 'correction-de-texte'
);

insert into public.services (name, slug)
select 'Costumier', 'costumier'
where not exists (
  select 1
  from public.services
  where slug = 'costumier'
);

insert into public.services (name, slug)
select 'Cours d''allemand', 'cours-d-allemand'
where not exists (
  select 1
  from public.services
  where slug = 'cours-d-allemand'
);

insert into public.services (name, slug)
select 'Cours d''anglais', 'cours-d-anglais'
where not exists (
  select 1
  from public.services
  where slug = 'cours-d-anglais'
);

insert into public.services (name, slug)
select 'Cours de chant', 'cours-de-chant'
where not exists (
  select 1
  from public.services
  where slug = 'cours-de-chant'
);

insert into public.services (name, slug)
select 'Cours de chimie', 'cours-de-chimie'
where not exists (
  select 1
  from public.services
  where slug = 'cours-de-chimie'
);

insert into public.services (name, slug)
select 'Cours de dessin', 'cours-de-dessin'
where not exists (
  select 1
  from public.services
  where slug = 'cours-de-dessin'
);

insert into public.services (name, slug)
select 'Cours de français', 'cours-de-francais'
where not exists (
  select 1
  from public.services
  where slug = 'cours-de-francais'
);

insert into public.services (name, slug)
select 'Cours de guitare', 'cours-de-guitare'
where not exists (
  select 1
  from public.services
  where slug = 'cours-de-guitare'
);

insert into public.services (name, slug)
select 'Cours de mathématiques', 'cours-de-mathematiques'
where not exists (
  select 1
  from public.services
  where slug = 'cours-de-mathematiques'
);

insert into public.services (name, slug)
select 'Cours de musique', 'cours-de-musique'
where not exists (
  select 1
  from public.services
  where slug = 'cours-de-musique'
);

insert into public.services (name, slug)
select 'Cours de néerlandais', 'cours-de-neerlandais'
where not exists (
  select 1
  from public.services
  where slug = 'cours-de-neerlandais'
);

insert into public.services (name, slug)
select 'Cours de physique', 'cours-de-physique'
where not exists (
  select 1
  from public.services
  where slug = 'cours-de-physique'
);

insert into public.services (name, slug)
select 'Cours de piano', 'cours-de-piano'
where not exists (
  select 1
  from public.services
  where slug = 'cours-de-piano'
);

insert into public.services (name, slug)
select 'Cours de programmation', 'cours-de-programmation'
where not exists (
  select 1
  from public.services
  where slug = 'cours-de-programmation'
);

insert into public.services (name, slug)
select 'Cours de sciences', 'cours-de-sciences'
where not exists (
  select 1
  from public.services
  where slug = 'cours-de-sciences'
);

insert into public.services (name, slug)
select 'Cours d''espagnol', 'cours-d-espagnol'
where not exists (
  select 1
  from public.services
  where slug = 'cours-d-espagnol'
);

insert into public.services (name, slug)
select 'Cours d''informatique', 'cours-d-informatique'
where not exists (
  select 1
  from public.services
  where slug = 'cours-d-informatique'
);

insert into public.services (name, slug)
select 'Courses à domicile', 'courses-a-domicile'
where not exists (
  select 1
  from public.services
  where slug = 'courses-a-domicile'
);

insert into public.services (name, slug)
select 'Coursier', 'coursier'
where not exists (
  select 1
  from public.services
  where slug = 'coursier'
);

insert into public.services (name, slug)
select 'Coursier à vélo', 'coursier-a-velo'
where not exists (
  select 1
  from public.services
  where slug = 'coursier-a-velo'
);

insert into public.services (name, slug)
select 'Cours particuliers', 'cours-particuliers'
where not exists (
  select 1
  from public.services
  where slug = 'cours-particuliers'
);

insert into public.services (name, slug)
select 'Couturier', 'couturier'
where not exists (
  select 1
  from public.services
  where slug = 'couturier'
);

insert into public.services (name, slug)
select 'Couturière', 'couturiere'
where not exists (
  select 1
  from public.services
  where slug = 'couturiere'
);

insert into public.services (name, slug)
select 'Couverture', 'couverture'
where not exists (
  select 1
  from public.services
  where slug = 'couverture'
);

insert into public.services (name, slug)
select 'Créateur de vêtements', 'createur-de-vetements'
where not exists (
  select 1
  from public.services
  where slug = 'createur-de-vetements'
);

insert into public.services (name, slug)
select 'Création d''affiches', 'creation-d-affiches'
where not exists (
  select 1
  from public.services
  where slug = 'creation-d-affiches'
);

insert into public.services (name, slug)
select 'Création de boutique en ligne', 'creation-de-boutique-en-ligne'
where not exists (
  select 1
  from public.services
  where slug = 'creation-de-boutique-en-ligne'
);

insert into public.services (name, slug)
select 'Création de cartes de visite', 'creation-de-cartes-de-visite'
where not exists (
  select 1
  from public.services
  where slug = 'creation-de-cartes-de-visite'
);

insert into public.services (name, slug)
select 'Création de contenu', 'creation-de-contenu'
where not exists (
  select 1
  from public.services
  where slug = 'creation-de-contenu'
);

insert into public.services (name, slug)
select 'Création de CV', 'creation-de-cv'
where not exists (
  select 1
  from public.services
  where slug = 'creation-de-cv'
);

insert into public.services (name, slug)
select 'Création de flyers', 'creation-de-flyers'
where not exists (
  select 1
  from public.services
  where slug = 'creation-de-flyers'
);

insert into public.services (name, slug)
select 'Création de site internet', 'creation-de-site-internet'
where not exists (
  select 1
  from public.services
  where slug = 'creation-de-site-internet'
);

insert into public.services (name, slug)
select 'Cuisine équipée', 'cuisine-equipee'
where not exists (
  select 1
  from public.services
  where slug = 'cuisine-equipee'
);

insert into public.services (name, slug)
select 'Cuisinier à domicile', 'cuisinier-a-domicile'
where not exists (
  select 1
  from public.services
  where slug = 'cuisinier-a-domicile'
);

insert into public.services (name, slug)
select 'Cybersécurité', 'cybersecurite'
where not exists (
  select 1
  from public.services
  where slug = 'cybersecurite'
);

insert into public.services (name, slug)
select 'Data analyst', 'data-analyst'
where not exists (
  select 1
  from public.services
  where slug = 'data-analyst'
);

insert into public.services (name, slug)
select 'Data engineer', 'data-engineer'
where not exists (
  select 1
  from public.services
  where slug = 'data-engineer'
);

insert into public.services (name, slug)
select 'Déballage de cartons', 'deballage-de-cartons'
where not exists (
  select 1
  from public.services
  where slug = 'deballage-de-cartons'
);

insert into public.services (name, slug)
select 'Débarras', 'debarras'
where not exists (
  select 1
  from public.services
  where slug = 'debarras'
);

insert into public.services (name, slug)
select 'Débosselage', 'debosselage'
where not exists (
  select 1
  from public.services
  where slug = 'debosselage'
);

insert into public.services (name, slug)
select 'Débouchage', 'debouchage'
where not exists (
  select 1
  from public.services
  where slug = 'debouchage'
);

insert into public.services (name, slug)
select 'Débroussaillage', 'debroussaillage'
where not exists (
  select 1
  from public.services
  where slug = 'debroussaillage'
);

insert into public.services (name, slug)
select 'Décorateur événementiel', 'decorateur-evenementiel'
where not exists (
  select 1
  from public.services
  where slug = 'decorateur-evenementiel'
);

insert into public.services (name, slug)
select 'Décoration intérieure', 'decoration-interieure'
where not exists (
  select 1
  from public.services
  where slug = 'decoration-interieure'
);

insert into public.services (name, slug)
select 'Déménagement', 'demenagement'
where not exists (
  select 1
  from public.services
  where slug = 'demenagement'
);

insert into public.services (name, slug)
select 'Déménagement d''entreprise', 'demenagement-d-entreprise'
where not exists (
  select 1
  from public.services
  where slug = 'demenagement-d-entreprise'
);

insert into public.services (name, slug)
select 'Déménagement international', 'demenagement-international'
where not exists (
  select 1
  from public.services
  where slug = 'demenagement-international'
);

insert into public.services (name, slug)
select 'Démolition', 'demolition'
where not exists (
  select 1
  from public.services
  where slug = 'demolition'
);

insert into public.services (name, slug)
select 'Déneigement', 'deneigement'
where not exists (
  select 1
  from public.services
  where slug = 'deneigement'
);

insert into public.services (name, slug)
select 'Dépannage automobile', 'depannage-automobile'
where not exists (
  select 1
  from public.services
  where slug = 'depannage-automobile'
);

insert into public.services (name, slug)
select 'Dépannage électrique', 'depannage-electrique'
where not exists (
  select 1
  from public.services
  where slug = 'depannage-electrique'
);

insert into public.services (name, slug)
select 'Dépannage informatique', 'depannage-informatique'
where not exists (
  select 1
  from public.services
  where slug = 'depannage-informatique'
);

insert into public.services (name, slug)
select 'Designer graphique', 'designer-graphique'
where not exists (
  select 1
  from public.services
  where slug = 'designer-graphique'
);

insert into public.services (name, slug)
select 'Design packaging', 'design-packaging'
where not exists (
  select 1
  from public.services
  where slug = 'design-packaging'
);

insert into public.services (name, slug)
select 'Design produit', 'design-produit'
where not exists (
  select 1
  from public.services
  where slug = 'design-produit'
);

insert into public.services (name, slug)
select 'Désinfection', 'desinfection'
where not exists (
  select 1
  from public.services
  where slug = 'desinfection'
);

insert into public.services (name, slug)
select 'Dessin', 'dessin'
where not exists (
  select 1
  from public.services
  where slug = 'dessin'
);

insert into public.services (name, slug)
select 'Detailing automobile', 'detailing-automobile'
where not exists (
  select 1
  from public.services
  where slug = 'detailing-automobile'
);

insert into public.services (name, slug)
select 'Développeur backend', 'developpeur-backend'
where not exists (
  select 1
  from public.services
  where slug = 'developpeur-backend'
);

insert into public.services (name, slug)
select 'Développeur frontend', 'developpeur-frontend'
where not exists (
  select 1
  from public.services
  where slug = 'developpeur-frontend'
);

insert into public.services (name, slug)
select 'Développeur full-stack', 'developpeur-full-stack'
where not exists (
  select 1
  from public.services
  where slug = 'developpeur-full-stack'
);

insert into public.services (name, slug)
select 'Développeur logiciel', 'developpeur-logiciel'
where not exists (
  select 1
  from public.services
  where slug = 'developpeur-logiciel'
);

insert into public.services (name, slug)
select 'Développeur mobile', 'developpeur-mobile'
where not exists (
  select 1
  from public.services
  where slug = 'developpeur-mobile'
);

insert into public.services (name, slug)
select 'Développeur web', 'developpeur-web'
where not exists (
  select 1
  from public.services
  where slug = 'developpeur-web'
);

insert into public.services (name, slug)
select 'DevOps', 'devops'
where not exists (
  select 1
  from public.services
  where slug = 'devops'
);

insert into public.services (name, slug)
select 'Diagnostic automobile', 'diagnostic-automobile'
where not exists (
  select 1
  from public.services
  where slug = 'diagnostic-automobile'
);

insert into public.services (name, slug)
select 'DJ', 'dj'
where not exists (
  select 1
  from public.services
  where slug = 'dj'
);

insert into public.services (name, slug)
select 'Domotique', 'domotique'
where not exists (
  select 1
  from public.services
  where slug = 'domotique'
);

insert into public.services (name, slug)
select 'Drone', 'drone'
where not exists (
  select 1
  from public.services
  where slug = 'drone'
);

insert into public.services (name, slug)
select 'Ébénisterie', 'ebenisterie'
where not exists (
  select 1
  from public.services
  where slug = 'ebenisterie'
);

insert into public.services (name, slug)
select 'Éclairage', 'eclairage'
where not exists (
  select 1
  from public.services
  where slug = 'eclairage'
);

insert into public.services (name, slug)
select 'Éclairage événementiel', 'eclairage-evenementiel'
where not exists (
  select 1
  from public.services
  where slug = 'eclairage-evenementiel'
);

insert into public.services (name, slug)
select 'Éducation canine', 'education-canine'
where not exists (
  select 1
  from public.services
  where slug = 'education-canine'
);

insert into public.services (name, slug)
select 'Élagage', 'elagage'
where not exists (
  select 1
  from public.services
  where slug = 'elagage'
);

insert into public.services (name, slug)
select 'Électricien', 'electricien'
where not exists (
  select 1
  from public.services
  where slug = 'electricien'
);

insert into public.services (name, slug)
select 'Électricité automobile', 'electricite-automobile'
where not exists (
  select 1
  from public.services
  where slug = 'electricite-automobile'
);

insert into public.services (name, slug)
select 'Email marketing', 'email-marketing'
where not exists (
  select 1
  from public.services
  where slug = 'email-marketing'
);

insert into public.services (name, slug)
select 'Emballage de cartons', 'emballage-de-cartons'
where not exists (
  select 1
  from public.services
  where slug = 'emballage-de-cartons'
);

insert into public.services (name, slug)
select 'Emballeur', 'emballeur'
where not exists (
  select 1
  from public.services
  where slug = 'emballeur'
);

insert into public.services (name, slug)
select 'Enduit', 'enduit'
where not exists (
  select 1
  from public.services
  where slug = 'enduit'
);

insert into public.services (name, slug)
select 'Entreprise générale du bâtiment', 'entreprise-generale-du-batiment'
where not exists (
  select 1
  from public.services
  where slug = 'entreprise-generale-du-batiment'
);

insert into public.services (name, slug)
select 'Entretien aquarium', 'entretien-aquarium'
where not exists (
  select 1
  from public.services
  where slug = 'entretien-aquarium'
);

insert into public.services (name, slug)
select 'Entretien automobile', 'entretien-automobile'
where not exists (
  select 1
  from public.services
  where slug = 'entretien-automobile'
);

insert into public.services (name, slug)
select 'Entretien chaudière', 'entretien-chaudiere'
where not exists (
  select 1
  from public.services
  where slug = 'entretien-chaudiere'
);

insert into public.services (name, slug)
select 'Entretien climatisation', 'entretien-climatisation'
where not exists (
  select 1
  from public.services
  where slug = 'entretien-climatisation'
);

insert into public.services (name, slug)
select 'Entretien de jardin', 'entretien-de-jardin'
where not exists (
  select 1
  from public.services
  where slug = 'entretien-de-jardin'
);

insert into public.services (name, slug)
select 'Entretien de terrain', 'entretien-de-terrain'
where not exists (
  select 1
  from public.services
  where slug = 'entretien-de-terrain'
);

insert into public.services (name, slug)
select 'Entretien de verger', 'entretien-de-verger'
where not exists (
  select 1
  from public.services
  where slug = 'entretien-de-verger'
);

insert into public.services (name, slug)
select 'Entretien forestier', 'entretien-forestier'
where not exists (
  select 1
  from public.services
  where slug = 'entretien-forestier'
);

insert into public.services (name, slug)
select 'Entretien logement Airbnb', 'entretien-logement-airbnb'
where not exists (
  select 1
  from public.services
  where slug = 'entretien-logement-airbnb'
);

insert into public.services (name, slug)
select 'Entretien panneaux solaires', 'entretien-panneaux-solaires'
where not exists (
  select 1
  from public.services
  where slug = 'entretien-panneaux-solaires'
);

insert into public.services (name, slug)
select 'Entretien piscine', 'entretien-piscine'
where not exists (
  select 1
  from public.services
  where slug = 'entretien-piscine'
);

insert into public.services (name, slug)
select 'Entretien radiateur', 'entretien-radiateur'
where not exists (
  select 1
  from public.services
  where slug = 'entretien-radiateur'
);

insert into public.services (name, slug)
select 'Entretien vélo', 'entretien-velo'
where not exists (
  select 1
  from public.services
  where slug = 'entretien-velo'
);

insert into public.services (name, slug)
select 'Épilation', 'epilation'
where not exists (
  select 1
  from public.services
  where slug = 'epilation'
);

insert into public.services (name, slug)
select 'Esthéticienne', 'estheticienne'
where not exists (
  select 1
  from public.services
  where slug = 'estheticienne'
);

insert into public.services (name, slug)
select 'Étanchéité toiture', 'etancheite-toiture'
where not exists (
  select 1
  from public.services
  where slug = 'etancheite-toiture'
);

insert into public.services (name, slug)
select 'État des lieux', 'etat-des-lieux'
where not exists (
  select 1
  from public.services
  where slug = 'etat-des-lieux'
);

insert into public.services (name, slug)
select 'Expert technique', 'expert-technique'
where not exists (
  select 1
  from public.services
  where slug = 'expert-technique'
);

insert into public.services (name, slug)
select 'Extension de cils', 'extension-de-cils'
where not exists (
  select 1
  from public.services
  where slug = 'extension-de-cils'
);

insert into public.services (name, slug)
select 'Extensions capillaires', 'extensions-capillaires'
where not exists (
  select 1
  from public.services
  where slug = 'extensions-capillaires'
);

insert into public.services (name, slug)
select 'Façade', 'facade'
where not exists (
  select 1
  from public.services
  where slug = 'facade'
);

insert into public.services (name, slug)
select 'Facturation', 'facturation'
where not exists (
  select 1
  from public.services
  where slug = 'facturation'
);

insert into public.services (name, slug)
select 'Faïence', 'faience'
where not exists (
  select 1
  from public.services
  where slug = 'faience'
);

insert into public.services (name, slug)
select 'Ferronnerie', 'ferronnerie'
where not exists (
  select 1
  from public.services
  where slug = 'ferronnerie'
);

insert into public.services (name, slug)
select 'Fixation TV murale', 'fixation-tv-murale'
where not exists (
  select 1
  from public.services
  where slug = 'fixation-tv-murale'
);

insert into public.services (name, slug)
select 'Formateur', 'formateur'
where not exists (
  select 1
  from public.services
  where slug = 'formateur'
);

insert into public.services (name, slug)
select 'Formation professionnelle', 'formation-professionnelle'
where not exists (
  select 1
  from public.services
  where slug = 'formation-professionnelle'
);

insert into public.services (name, slug)
select 'Freins', 'freins'
where not exists (
  select 1
  from public.services
  where slug = 'freins'
);

insert into public.services (name, slug)
select 'Garde après l''école', 'garde-apres-l-ecole'
where not exists (
  select 1
  from public.services
  where slug = 'garde-apres-l-ecole'
);

insert into public.services (name, slug)
select 'Garde de chat', 'garde-de-chat'
where not exists (
  select 1
  from public.services
  where slug = 'garde-de-chat'
);

insert into public.services (name, slug)
select 'Garde de chien', 'garde-de-chien'
where not exists (
  select 1
  from public.services
  where slug = 'garde-de-chien'
);

insert into public.services (name, slug)
select 'Garde d''enfants', 'garde-d-enfants'
where not exists (
  select 1
  from public.services
  where slug = 'garde-d-enfants'
);

insert into public.services (name, slug)
select 'Garde d''enfants événementielle', 'garde-d-enfants-evenementielle'
where not exists (
  select 1
  from public.services
  where slug = 'garde-d-enfants-evenementielle'
);

insert into public.services (name, slug)
select 'Garde de nuit', 'garde-de-nuit'
where not exists (
  select 1
  from public.services
  where slug = 'garde-de-nuit'
);

insert into public.services (name, slug)
select 'Garde de nuit à domicile', 'garde-de-nuit-a-domicile'
where not exists (
  select 1
  from public.services
  where slug = 'garde-de-nuit-a-domicile'
);

insert into public.services (name, slug)
select 'Gardiennage', 'gardiennage'
where not exists (
  select 1
  from public.services
  where slug = 'gardiennage'
);

insert into public.services (name, slug)
select 'Géomètre', 'geometre'
where not exists (
  select 1
  from public.services
  where slug = 'geometre'
);

insert into public.services (name, slug)
select 'Gestion administrative financière', 'gestion-administrative-financiere'
where not exists (
  select 1
  from public.services
  where slug = 'gestion-administrative-financiere'
);

insert into public.services (name, slug)
select 'Gestion de projet', 'gestion-de-projet'
where not exists (
  select 1
  from public.services
  where slug = 'gestion-de-projet'
);

insert into public.services (name, slug)
select 'Gestion de réputation', 'gestion-de-reputation'
where not exists (
  select 1
  from public.services
  where slug = 'gestion-de-reputation'
);

insert into public.services (name, slug)
select 'Gestion de stock', 'gestion-de-stock'
where not exists (
  select 1
  from public.services
  where slug = 'gestion-de-stock'
);

insert into public.services (name, slug)
select 'Gestion locative', 'gestion-locative'
where not exists (
  select 1
  from public.services
  where slug = 'gestion-locative'
);

insert into public.services (name, slug)
select 'Graphiste', 'graphiste'
where not exists (
  select 1
  from public.services
  where slug = 'graphiste'
);

insert into public.services (name, slug)
select 'Groupe de musique', 'groupe-de-musique'
where not exists (
  select 1
  from public.services
  where slug = 'groupe-de-musique'
);

insert into public.services (name, slug)
select 'Guide local', 'guide-local'
where not exists (
  select 1
  from public.services
  where slug = 'guide-local'
);

insert into public.services (name, slug)
select 'Guide touristique', 'guide-touristique'
where not exists (
  select 1
  from public.services
  where slug = 'guide-touristique'
);

insert into public.services (name, slug)
select 'Home staging', 'home-staging'
where not exists (
  select 1
  from public.services
  where slug = 'home-staging'
);

insert into public.services (name, slug)
select 'Hôtesse événementielle', 'hotesse-evenementielle'
where not exists (
  select 1
  from public.services
  where slug = 'hotesse-evenementielle'
);

insert into public.services (name, slug)
select 'Identité visuelle', 'identite-visuelle'
where not exists (
  select 1
  from public.services
  where slug = 'identite-visuelle'
);

insert into public.services (name, slug)
select 'Illustration', 'illustration'
where not exists (
  select 1
  from public.services
  where slug = 'illustration'
);

insert into public.services (name, slug)
select 'Impression textile', 'impression-textile'
where not exists (
  select 1
  from public.services
  where slug = 'impression-textile'
);

insert into public.services (name, slug)
select 'Influence marketing', 'influence-marketing'
where not exists (
  select 1
  from public.services
  where slug = 'influence-marketing'
);

insert into public.services (name, slug)
select 'Infographie', 'infographie'
where not exists (
  select 1
  from public.services
  where slug = 'infographie'
);

insert into public.services (name, slug)
select 'Ingénieur du son', 'ingenieur-du-son'
where not exists (
  select 1
  from public.services
  where slug = 'ingenieur-du-son'
);

insert into public.services (name, slug)
select 'Installation alarme', 'installation-alarme'
where not exists (
  select 1
  from public.services
  where slug = 'installation-alarme'
);

insert into public.services (name, slug)
select 'Installation borne de recharge', 'installation-borne-de-recharge'
where not exists (
  select 1
  from public.services
  where slug = 'installation-borne-de-recharge'
);

insert into public.services (name, slug)
select 'Installation caméra de surveillance', 'installation-camera-de-surveillance'
where not exists (
  select 1
  from public.services
  where slug = 'installation-camera-de-surveillance'
);

insert into public.services (name, slug)
select 'Installation chaudière', 'installation-chaudiere'
where not exists (
  select 1
  from public.services
  where slug = 'installation-chaudiere'
);

insert into public.services (name, slug)
select 'Installation climatisation', 'installation-climatisation'
where not exists (
  select 1
  from public.services
  where slug = 'installation-climatisation'
);

insert into public.services (name, slug)
select 'Installation de baignoire', 'installation-de-baignoire'
where not exists (
  select 1
  from public.services
  where slug = 'installation-de-baignoire'
);

insert into public.services (name, slug)
select 'Installation de douche', 'installation-de-douche'
where not exists (
  select 1
  from public.services
  where slug = 'installation-de-douche'
);

insert into public.services (name, slug)
select 'Installation d''électroménager', 'installation-d-electromenager'
where not exists (
  select 1
  from public.services
  where slug = 'installation-d-electromenager'
);

insert into public.services (name, slug)
select 'Installation de luminaires', 'installation-de-luminaires'
where not exists (
  select 1
  from public.services
  where slug = 'installation-de-luminaires'
);

insert into public.services (name, slug)
select 'Installation de mobilier professionnel', 'installation-de-mobilier-professionnel'
where not exists (
  select 1
  from public.services
  where slug = 'installation-de-mobilier-professionnel'
);

insert into public.services (name, slug)
select 'Installation de robinetterie', 'installation-de-robinetterie'
where not exists (
  select 1
  from public.services
  where slug = 'installation-de-robinetterie'
);

insert into public.services (name, slug)
select 'Installation de salle de bain', 'installation-de-salle-de-bain'
where not exists (
  select 1
  from public.services
  where slug = 'installation-de-salle-de-bain'
);

insert into public.services (name, slug)
select 'Installation de WC', 'installation-de-wc'
where not exists (
  select 1
  from public.services
  where slug = 'installation-de-wc'
);

insert into public.services (name, slug)
select 'Installation ordinateur', 'installation-ordinateur'
where not exists (
  select 1
  from public.services
  where slug = 'installation-ordinateur'
);

insert into public.services (name, slug)
select 'Installation photovoltaïque', 'installation-photovoltaique'
where not exists (
  select 1
  from public.services
  where slug = 'installation-photovoltaique'
);

insert into public.services (name, slug)
select 'Installation radiateur', 'installation-radiateur'
where not exists (
  select 1
  from public.services
  where slug = 'installation-radiateur'
);

insert into public.services (name, slug)
select 'Installation réseau', 'installation-reseau'
where not exists (
  select 1
  from public.services
  where slug = 'installation-reseau'
);

insert into public.services (name, slug)
select 'Installation sanitaire', 'installation-sanitaire'
where not exists (
  select 1
  from public.services
  where slug = 'installation-sanitaire'
);

insert into public.services (name, slug)
select 'Intégration API', 'integration-api'
where not exists (
  select 1
  from public.services
  where slug = 'integration-api'
);

insert into public.services (name, slug)
select 'Intelligence artificielle', 'intelligence-artificielle'
where not exists (
  select 1
  from public.services
  where slug = 'intelligence-artificielle'
);

insert into public.services (name, slug)
select 'Interprétariat', 'interpretariat'
where not exists (
  select 1
  from public.services
  where slug = 'interpretariat'
);

insert into public.services (name, slug)
select 'Interprète', 'interprete'
where not exists (
  select 1
  from public.services
  where slug = 'interprete'
);

insert into public.services (name, slug)
select 'Inventaire', 'inventaire'
where not exists (
  select 1
  from public.services
  where slug = 'inventaire'
);

insert into public.services (name, slug)
select 'Isolation', 'isolation'
where not exists (
  select 1
  from public.services
  where slug = 'isolation'
);

insert into public.services (name, slug)
select 'Isolation acoustique', 'isolation-acoustique'
where not exists (
  select 1
  from public.services
  where slug = 'isolation-acoustique'
);

insert into public.services (name, slug)
select 'Isolation thermique', 'isolation-thermique'
where not exists (
  select 1
  from public.services
  where slug = 'isolation-thermique'
);

insert into public.services (name, slug)
select 'Jardinier', 'jardinier'
where not exists (
  select 1
  from public.services
  where slug = 'jardinier'
);

insert into public.services (name, slug)
select 'Lavage automobile', 'lavage-automobile'
where not exists (
  select 1
  from public.services
  where slug = 'lavage-automobile'
);

insert into public.services (name, slug)
select 'Lecture et compagnie', 'lecture-et-compagnie'
where not exists (
  select 1
  from public.services
  where slug = 'lecture-et-compagnie'
);

insert into public.services (name, slug)
select 'Lettre de motivation', 'lettre-de-motivation'
where not exists (
  select 1
  from public.services
  where slug = 'lettre-de-motivation'
);

insert into public.services (name, slug)
select 'Livraison locale', 'livraison-locale'
where not exists (
  select 1
  from public.services
  where slug = 'livraison-locale'
);

insert into public.services (name, slug)
select 'Location avec chauffeur', 'location-avec-chauffeur'
where not exists (
  select 1
  from public.services
  where slug = 'location-avec-chauffeur'
);

insert into public.services (name, slug)
select 'Location de matériel événementiel', 'location-de-materiel-evenementiel'
where not exists (
  select 1
  from public.services
  where slug = 'location-de-materiel-evenementiel'
);

insert into public.services (name, slug)
select 'Locks', 'locks'
where not exists (
  select 1
  from public.services
  where slug = 'locks'
);

insert into public.services (name, slug)
select 'Logo', 'logo'
where not exists (
  select 1
  from public.services
  where slug = 'logo'
);

insert into public.services (name, slug)
select 'Maçonnerie', 'maconnerie'
where not exists (
  select 1
  from public.services
  where slug = 'maconnerie'
);

insert into public.services (name, slug)
select 'Magasinier', 'magasinier'
where not exists (
  select 1
  from public.services
  where slug = 'magasinier'
);

insert into public.services (name, slug)
select 'Maintenance locative', 'maintenance-locative'
where not exists (
  select 1
  from public.services
  where slug = 'maintenance-locative'
);

insert into public.services (name, slug)
select 'Maison connectée', 'maison-connectee'
where not exists (
  select 1
  from public.services
  where slug = 'maison-connectee'
);

insert into public.services (name, slug)
select 'Maître de cérémonie', 'maitre-de-ceremonie'
where not exists (
  select 1
  from public.services
  where slug = 'maitre-de-ceremonie'
);

insert into public.services (name, slug)
select 'Manucure', 'manucure'
where not exists (
  select 1
  from public.services
  where slug = 'manucure'
);

insert into public.services (name, slug)
select 'Manutention', 'manutention'
where not exists (
  select 1
  from public.services
  where slug = 'manutention'
);

insert into public.services (name, slug)
select 'Manutentionnaire', 'manutentionnaire'
where not exists (
  select 1
  from public.services
  where slug = 'manutentionnaire'
);

insert into public.services (name, slug)
select 'Maquillage', 'maquillage'
where not exists (
  select 1
  from public.services
  where slug = 'maquillage'
);

insert into public.services (name, slug)
select 'Maquillage événementiel', 'maquillage-evenementiel'
where not exists (
  select 1
  from public.services
  where slug = 'maquillage-evenementiel'
);

insert into public.services (name, slug)
select 'Maraîchage', 'maraichage'
where not exists (
  select 1
  from public.services
  where slug = 'maraichage'
);

insert into public.services (name, slug)
select 'Marketing digital', 'marketing-digital'
where not exists (
  select 1
  from public.services
  where slug = 'marketing-digital'
);

insert into public.services (name, slug)
select 'Massage bien-être', 'massage-bien-etre'
where not exists (
  select 1
  from public.services
  where slug = 'massage-bien-etre'
);

insert into public.services (name, slug)
select 'Massage sportif', 'massage-sportif'
where not exists (
  select 1
  from public.services
  where slug = 'massage-sportif'
);

insert into public.services (name, slug)
select 'Mastering audio', 'mastering-audio'
where not exists (
  select 1
  from public.services
  where slug = 'mastering-audio'
);

insert into public.services (name, slug)
select 'Meal prep', 'meal-prep'
where not exists (
  select 1
  from public.services
  where slug = 'meal-prep'
);

insert into public.services (name, slug)
select 'Mécanicien automobile', 'mecanicien-automobile'
where not exists (
  select 1
  from public.services
  where slug = 'mecanicien-automobile'
);

insert into public.services (name, slug)
select 'Mécanicien moto', 'mecanicien-moto'
where not exists (
  select 1
  from public.services
  where slug = 'mecanicien-moto'
);

insert into public.services (name, slug)
select 'Médiateur', 'mediateur'
where not exists (
  select 1
  from public.services
  where slug = 'mediateur'
);

insert into public.services (name, slug)
select 'Méditation', 'meditation'
where not exists (
  select 1
  from public.services
  where slug = 'meditation'
);

insert into public.services (name, slug)
select 'Ménage à domicile', 'menage-a-domicile'
where not exists (
  select 1
  from public.services
  where slug = 'menage-a-domicile'
);

insert into public.services (name, slug)
select 'Menuiserie', 'menuiserie'
where not exists (
  select 1
  from public.services
  where slug = 'menuiserie'
);

insert into public.services (name, slug)
select 'Mise aux normes électriques', 'mise-aux-normes-electriques'
where not exists (
  select 1
  from public.services
  where slug = 'mise-aux-normes-electriques'
);

insert into public.services (name, slug)
select 'Mise en page', 'mise-en-page'
where not exists (
  select 1
  from public.services
  where slug = 'mise-en-page'
);

insert into public.services (name, slug)
select 'Mixage audio', 'mixage-audio'
where not exists (
  select 1
  from public.services
  where slug = 'mixage-audio'
);

insert into public.services (name, slug)
select 'Montage de meubles', 'montage-de-meubles'
where not exists (
  select 1
  from public.services
  where slug = 'montage-de-meubles'
);

insert into public.services (name, slug)
select 'Montage de pneus', 'montage-de-pneus'
where not exists (
  select 1
  from public.services
  where slug = 'montage-de-pneus'
);

insert into public.services (name, slug)
select 'Montage de stand', 'montage-de-stand'
where not exists (
  select 1
  from public.services
  where slug = 'montage-de-stand'
);

insert into public.services (name, slug)
select 'Montage vidéo', 'montage-video'
where not exists (
  select 1
  from public.services
  where slug = 'montage-video'
);

insert into public.services (name, slug)
select 'Monte-meubles', 'monte-meubles'
where not exists (
  select 1
  from public.services
  where slug = 'monte-meubles'
);

insert into public.services (name, slug)
select 'Motion design', 'motion-design'
where not exists (
  select 1
  from public.services
  where slug = 'motion-design'
);

insert into public.services (name, slug)
select 'Musicien', 'musicien'
where not exists (
  select 1
  from public.services
  where slug = 'musicien'
);

insert into public.services (name, slug)
select 'Nettoyage après déménagement', 'nettoyage-apres-demenagement'
where not exists (
  select 1
  from public.services
  where slug = 'nettoyage-apres-demenagement'
);

insert into public.services (name, slug)
select 'Nettoyage après travaux', 'nettoyage-apres-travaux'
where not exists (
  select 1
  from public.services
  where slug = 'nettoyage-apres-travaux'
);

insert into public.services (name, slug)
select 'Nettoyage automobile', 'nettoyage-automobile'
where not exists (
  select 1
  from public.services
  where slug = 'nettoyage-automobile'
);

insert into public.services (name, slug)
select 'Nettoyage avant état des lieux', 'nettoyage-avant-etat-des-lieux'
where not exists (
  select 1
  from public.services
  where slug = 'nettoyage-avant-etat-des-lieux'
);

insert into public.services (name, slug)
select 'Nettoyage commercial', 'nettoyage-commercial'
where not exists (
  select 1
  from public.services
  where slug = 'nettoyage-commercial'
);

insert into public.services (name, slug)
select 'Nettoyage de bureaux', 'nettoyage-de-bureaux'
where not exists (
  select 1
  from public.services
  where slug = 'nettoyage-de-bureaux'
);

insert into public.services (name, slug)
select 'Nettoyage de canapé', 'nettoyage-de-canape'
where not exists (
  select 1
  from public.services
  where slug = 'nettoyage-de-canape'
);

insert into public.services (name, slug)
select 'Nettoyage de façade', 'nettoyage-de-facade'
where not exists (
  select 1
  from public.services
  where slug = 'nettoyage-de-facade'
);

insert into public.services (name, slug)
select 'Nettoyage de gouttières', 'nettoyage-de-gouttieres'
where not exists (
  select 1
  from public.services
  where slug = 'nettoyage-de-gouttieres'
);

insert into public.services (name, slug)
select 'Nettoyage de matelas', 'nettoyage-de-matelas'
where not exists (
  select 1
  from public.services
  where slug = 'nettoyage-de-matelas'
);

insert into public.services (name, slug)
select 'Nettoyage de moquettes', 'nettoyage-de-moquettes'
where not exists (
  select 1
  from public.services
  where slug = 'nettoyage-de-moquettes'
);

insert into public.services (name, slug)
select 'Nettoyage de tapis', 'nettoyage-de-tapis'
where not exists (
  select 1
  from public.services
  where slug = 'nettoyage-de-tapis'
);

insert into public.services (name, slug)
select 'Nettoyage de toiture', 'nettoyage-de-toiture'
where not exists (
  select 1
  from public.services
  where slug = 'nettoyage-de-toiture'
);

insert into public.services (name, slug)
select 'Nettoyage de vitres', 'nettoyage-de-vitres'
where not exists (
  select 1
  from public.services
  where slug = 'nettoyage-de-vitres'
);

insert into public.services (name, slug)
select 'Nettoyage extérieur', 'nettoyage-exterieur'
where not exists (
  select 1
  from public.services
  where slug = 'nettoyage-exterieur'
);

insert into public.services (name, slug)
select 'Nettoyage haute pression', 'nettoyage-haute-pression'
where not exists (
  select 1
  from public.services
  where slug = 'nettoyage-haute-pression'
);

insert into public.services (name, slug)
select 'Nettoyage industriel', 'nettoyage-industriel'
where not exists (
  select 1
  from public.services
  where slug = 'nettoyage-industriel'
);

insert into public.services (name, slug)
select 'Nettoyage location courte durée', 'nettoyage-location-courte-duree'
where not exists (
  select 1
  from public.services
  where slug = 'nettoyage-location-courte-duree'
);

insert into public.services (name, slug)
select 'Nounou', 'nounou'
where not exists (
  select 1
  from public.services
  where slug = 'nounou'
);

insert into public.services (name, slug)
select 'Organisateur d''événement', 'organisateur-d-evenement'
where not exists (
  select 1
  from public.services
  where slug = 'organisateur-d-evenement'
);

insert into public.services (name, slug)
select 'Organisation d''excursion', 'organisation-d-excursion'
where not exists (
  select 1
  from public.services
  where slug = 'organisation-d-excursion'
);

insert into public.services (name, slug)
select 'Ouvrier agricole', 'ouvrier-agricole'
where not exists (
  select 1
  from public.services
  where slug = 'ouvrier-agricole'
);

insert into public.services (name, slug)
select 'Pâtissier', 'patissier'
where not exists (
  select 1
  from public.services
  where slug = 'patissier'
);

insert into public.services (name, slug)
select 'Pavage', 'pavage'
where not exists (
  select 1
  from public.services
  where slug = 'pavage'
);

insert into public.services (name, slug)
select 'Paysagiste', 'paysagiste'
where not exists (
  select 1
  from public.services
  where slug = 'paysagiste'
);

insert into public.services (name, slug)
select 'Pédicure esthétique', 'pedicure-esthetique'
where not exists (
  select 1
  from public.services
  where slug = 'pedicure-esthetique'
);

insert into public.services (name, slug)
select 'Peinture automobile', 'peinture-automobile'
where not exists (
  select 1
  from public.services
  where slug = 'peinture-automobile'
);

insert into public.services (name, slug)
select 'Peinture extérieure', 'peinture-exterieure'
where not exists (
  select 1
  from public.services
  where slug = 'peinture-exterieure'
);

insert into public.services (name, slug)
select 'Peinture intérieure', 'peinture-interieure'
where not exists (
  select 1
  from public.services
  where slug = 'peinture-interieure'
);

insert into public.services (name, slug)
select 'Pension pour animaux', 'pension-pour-animaux'
where not exists (
  select 1
  from public.services
  where slug = 'pension-pour-animaux'
);

insert into public.services (name, slug)
select 'Personal shopper', 'personal-shopper'
where not exists (
  select 1
  from public.services
  where slug = 'personal-shopper'
);

insert into public.services (name, slug)
select 'Personal trainer', 'personal-trainer'
where not exists (
  select 1
  from public.services
  where slug = 'personal-trainer'
);

insert into public.services (name, slug)
select 'Petit déménagement', 'petit-demenagement'
where not exists (
  select 1
  from public.services
  where slug = 'petit-demenagement'
);

insert into public.services (name, slug)
select 'Petite électricité', 'petite-electricite'
where not exists (
  select 1
  from public.services
  where slug = 'petite-electricite'
);

insert into public.services (name, slug)
select 'Petite plomberie', 'petite-plomberie'
where not exists (
  select 1
  from public.services
  where slug = 'petite-plomberie'
);

insert into public.services (name, slug)
select 'Pet-sitting', 'pet-sitting'
where not exists (
  select 1
  from public.services
  where slug = 'pet-sitting'
);

insert into public.services (name, slug)
select 'Photobooth', 'photobooth'
where not exists (
  select 1
  from public.services
  where slug = 'photobooth'
);

insert into public.services (name, slug)
select 'Photographe', 'photographe'
where not exists (
  select 1
  from public.services
  where slug = 'photographe'
);

insert into public.services (name, slug)
select 'Photographe événementiel', 'photographe-evenementiel'
where not exists (
  select 1
  from public.services
  where slug = 'photographe-evenementiel'
);

insert into public.services (name, slug)
select 'Photographe immobilier', 'photographe-immobilier'
where not exists (
  select 1
  from public.services
  where slug = 'photographe-immobilier'
);

insert into public.services (name, slug)
select 'Photographe mariage', 'photographe-mariage'
where not exists (
  select 1
  from public.services
  where slug = 'photographe-mariage'
);

insert into public.services (name, slug)
select 'Photographe portrait', 'photographe-portrait'
where not exists (
  select 1
  from public.services
  where slug = 'photographe-portrait'
);

insert into public.services (name, slug)
select 'Photographie immobilière', 'photographie-immobiliere'
where not exists (
  select 1
  from public.services
  where slug = 'photographie-immobiliere'
);

insert into public.services (name, slug)
select 'Piscine', 'piscine'
where not exists (
  select 1
  from public.services
  where slug = 'piscine'
);

insert into public.services (name, slug)
select 'Plantation', 'plantation'
where not exists (
  select 1
  from public.services
  where slug = 'plantation'
);

insert into public.services (name, slug)
select 'Plaquiste', 'plaquiste'
where not exists (
  select 1
  from public.services
  where slug = 'plaquiste'
);

insert into public.services (name, slug)
select 'Plâtrerie', 'platrerie'
where not exists (
  select 1
  from public.services
  where slug = 'platrerie'
);

insert into public.services (name, slug)
select 'Plombier', 'plombier'
where not exists (
  select 1
  from public.services
  where slug = 'plombier'
);

insert into public.services (name, slug)
select 'Pneus', 'pneus'
where not exists (
  select 1
  from public.services
  where slug = 'pneus'
);

insert into public.services (name, slug)
select 'Podcast', 'podcast'
where not exists (
  select 1
  from public.services
  where slug = 'podcast'
);

insert into public.services (name, slug)
select 'Pompe à chaleur', 'pompe-a-chaleur'
where not exists (
  select 1
  from public.services
  where slug = 'pompe-a-chaleur'
);

insert into public.services (name, slug)
select 'Portage de meubles', 'portage-de-meubles'
where not exists (
  select 1
  from public.services
  where slug = 'portage-de-meubles'
);

insert into public.services (name, slug)
select 'Pose de cloisons', 'pose-de-cloisons'
where not exists (
  select 1
  from public.services
  where slug = 'pose-de-cloisons'
);

insert into public.services (name, slug)
select 'Pose de clôture', 'pose-de-cloture'
where not exists (
  select 1
  from public.services
  where slug = 'pose-de-cloture'
);

insert into public.services (name, slug)
select 'Pose de faux cils', 'pose-de-faux-cils'
where not exists (
  select 1
  from public.services
  where slug = 'pose-de-faux-cils'
);

insert into public.services (name, slug)
select 'Pose de fenêtres', 'pose-de-fenetres'
where not exists (
  select 1
  from public.services
  where slug = 'pose-de-fenetres'
);

insert into public.services (name, slug)
select 'Pose de joints', 'pose-de-joints'
where not exists (
  select 1
  from public.services
  where slug = 'pose-de-joints'
);

insert into public.services (name, slug)
select 'Pose de moquette', 'pose-de-moquette'
where not exists (
  select 1
  from public.services
  where slug = 'pose-de-moquette'
);

insert into public.services (name, slug)
select 'Pose de parquet', 'pose-de-parquet'
where not exists (
  select 1
  from public.services
  where slug = 'pose-de-parquet'
);

insert into public.services (name, slug)
select 'Pose de portail', 'pose-de-portail'
where not exists (
  select 1
  from public.services
  where slug = 'pose-de-portail'
);

insert into public.services (name, slug)
select 'Pose de portes', 'pose-de-portes'
where not exists (
  select 1
  from public.services
  where slug = 'pose-de-portes'
);

insert into public.services (name, slug)
select 'Pose de rideaux', 'pose-de-rideaux'
where not exists (
  select 1
  from public.services
  where slug = 'pose-de-rideaux'
);

insert into public.services (name, slug)
select 'Pose de serrure', 'pose-de-serrure'
where not exists (
  select 1
  from public.services
  where slug = 'pose-de-serrure'
);

insert into public.services (name, slug)
select 'Pose de sol stratifié', 'pose-de-sol-stratifie'
where not exists (
  select 1
  from public.services
  where slug = 'pose-de-sol-stratifie'
);

insert into public.services (name, slug)
select 'Pose de stores', 'pose-de-stores'
where not exists (
  select 1
  from public.services
  where slug = 'pose-de-stores'
);

insert into public.services (name, slug)
select 'Pose d''étagères', 'pose-d-etageres'
where not exists (
  select 1
  from public.services
  where slug = 'pose-d-etageres'
);

insert into public.services (name, slug)
select 'Pose de tringles', 'pose-de-tringles'
where not exists (
  select 1
  from public.services
  where slug = 'pose-de-tringles'
);

insert into public.services (name, slug)
select 'Pose de vinyle', 'pose-de-vinyle'
where not exists (
  select 1
  from public.services
  where slug = 'pose-de-vinyle'
);

insert into public.services (name, slug)
select 'Potager', 'potager'
where not exists (
  select 1
  from public.services
  where slug = 'potager'
);

insert into public.services (name, slug)
select 'Préparateur de commandes', 'preparateur-de-commandes'
where not exists (
  select 1
  from public.services
  where slug = 'preparateur-de-commandes'
);

insert into public.services (name, slug)
select 'Préparation aux examens', 'preparation-aux-examens'
where not exists (
  select 1
  from public.services
  where slug = 'preparation-aux-examens'
);

insert into public.services (name, slug)
select 'Préparation de documents comptables', 'preparation-de-documents-comptables'
where not exists (
  select 1
  from public.services
  where slug = 'preparation-de-documents-comptables'
);

insert into public.services (name, slug)
select 'Préparation de repas', 'preparation-de-repas'
where not exists (
  select 1
  from public.services
  where slug = 'preparation-de-repas'
);

insert into public.services (name, slug)
select 'Préparation de repas à domicile', 'preparation-de-repas-a-domicile'
where not exists (
  select 1
  from public.services
  where slug = 'preparation-de-repas-a-domicile'
);

insert into public.services (name, slug)
select 'Préparation physique', 'preparation-physique'
where not exists (
  select 1
  from public.services
  where slug = 'preparation-physique'
);

insert into public.services (name, slug)
select 'Présentation professionnelle', 'presentation-professionnelle'
where not exists (
  select 1
  from public.services
  where slug = 'presentation-professionnelle'
);

insert into public.services (name, slug)
select 'Pressing à domicile', 'pressing-a-domicile'
where not exists (
  select 1
  from public.services
  where slug = 'pressing-a-domicile'
);

insert into public.services (name, slug)
select 'Prises et interrupteurs', 'prises-et-interrupteurs'
where not exists (
  select 1
  from public.services
  where slug = 'prises-et-interrupteurs'
);

insert into public.services (name, slug)
select 'Professeur de danse', 'professeur-de-danse'
where not exists (
  select 1
  from public.services
  where slug = 'professeur-de-danse'
);

insert into public.services (name, slug)
select 'Professeur de pilates', 'professeur-de-pilates'
where not exists (
  select 1
  from public.services
  where slug = 'professeur-de-pilates'
);

insert into public.services (name, slug)
select 'Professeur de yoga', 'professeur-de-yoga'
where not exists (
  select 1
  from public.services
  where slug = 'professeur-de-yoga'
);

insert into public.services (name, slug)
select 'Promenade de chien', 'promenade-de-chien'
where not exists (
  select 1
  from public.services
  where slug = 'promenade-de-chien'
);

insert into public.services (name, slug)
select 'Prospection commerciale', 'prospection-commerciale'
where not exists (
  select 1
  from public.services
  where slug = 'prospection-commerciale'
);

insert into public.services (name, slug)
select 'Prothésiste ongulaire', 'prothesiste-ongulaire'
where not exists (
  select 1
  from public.services
  where slug = 'prothesiste-ongulaire'
);

insert into public.services (name, slug)
select 'Publicité en ligne', 'publicite-en-ligne'
where not exists (
  select 1
  from public.services
  where slug = 'publicite-en-ligne'
);

insert into public.services (name, slug)
select 'Ramassage de feuilles', 'ramassage-de-feuilles'
where not exists (
  select 1
  from public.services
  where slug = 'ramassage-de-feuilles'
);

insert into public.services (name, slug)
select 'Ravalement de façade', 'ravalement-de-facade'
where not exists (
  select 1
  from public.services
  where slug = 'ravalement-de-facade'
);

insert into public.services (name, slug)
select 'Recherche de fuite', 'recherche-de-fuite'
where not exists (
  select 1
  from public.services
  where slug = 'recherche-de-fuite'
);

insert into public.services (name, slug)
select 'Récolte', 'recolte'
where not exists (
  select 1
  from public.services
  where slug = 'recolte'
);

insert into public.services (name, slug)
select 'Recrutement', 'recrutement'
where not exists (
  select 1
  from public.services
  where slug = 'recrutement'
);

insert into public.services (name, slug)
select 'Récupération de données', 'recuperation-de-donnees'
where not exists (
  select 1
  from public.services
  where slug = 'recuperation-de-donnees'
);

insert into public.services (name, slug)
select 'Rédaction web', 'redaction-web'
where not exists (
  select 1
  from public.services
  where slug = 'redaction-web'
);

insert into public.services (name, slug)
select 'Relations publiques', 'relations-publiques'
where not exists (
  select 1
  from public.services
  where slug = 'relations-publiques'
);

insert into public.services (name, slug)
select 'Relaxation', 'relaxation'
where not exists (
  select 1
  from public.services
  where slug = 'relaxation'
);

insert into public.services (name, slug)
select 'Relecture', 'relecture'
where not exists (
  select 1
  from public.services
  where slug = 'relecture'
);

insert into public.services (name, slug)
select 'Remise de clés', 'remise-de-cles'
where not exists (
  select 1
  from public.services
  where slug = 'remise-de-cles'
);

insert into public.services (name, slug)
select 'Remorquage', 'remorquage'
where not exists (
  select 1
  from public.services
  where slug = 'remorquage'
);

insert into public.services (name, slug)
select 'Rénovation générale', 'renovation-generale'
where not exists (
  select 1
  from public.services
  where slug = 'renovation-generale'
);

insert into public.services (name, slug)
select 'Réparation chaudière', 'reparation-chaudiere'
where not exists (
  select 1
  from public.services
  where slug = 'reparation-chaudiere'
);

insert into public.services (name, slug)
select 'Réparation de chaussures', 'reparation-de-chaussures'
where not exists (
  select 1
  from public.services
  where slug = 'reparation-de-chaussures'
);

insert into public.services (name, slug)
select 'Réparation de fenêtres', 'reparation-de-fenetres'
where not exists (
  select 1
  from public.services
  where slug = 'reparation-de-fenetres'
);

insert into public.services (name, slug)
select 'Réparation de fuite', 'reparation-de-fuite'
where not exists (
  select 1
  from public.services
  where slug = 'reparation-de-fuite'
);

insert into public.services (name, slug)
select 'Réparation d''électroménager', 'reparation-d-electromenager'
where not exists (
  select 1
  from public.services
  where slug = 'reparation-d-electromenager'
);

insert into public.services (name, slug)
select 'Réparation de meubles', 'reparation-de-meubles'
where not exists (
  select 1
  from public.services
  where slug = 'reparation-de-meubles'
);

insert into public.services (name, slug)
select 'Réparation de portes', 'reparation-de-portes'
where not exists (
  select 1
  from public.services
  where slug = 'reparation-de-portes'
);

insert into public.services (name, slug)
select 'Réparation de serrures', 'reparation-de-serrures'
where not exists (
  select 1
  from public.services
  where slug = 'reparation-de-serrures'
);

insert into public.services (name, slug)
select 'Réparation de volets', 'reparation-de-volets'
where not exists (
  select 1
  from public.services
  where slug = 'reparation-de-volets'
);

insert into public.services (name, slug)
select 'Réparation Mac', 'reparation-mac'
where not exists (
  select 1
  from public.services
  where slug = 'reparation-mac'
);

insert into public.services (name, slug)
select 'Réparation ordinateur', 'reparation-ordinateur'
where not exists (
  select 1
  from public.services
  where slug = 'reparation-ordinateur'
);

insert into public.services (name, slug)
select 'Réparation PC', 'reparation-pc'
where not exists (
  select 1
  from public.services
  where slug = 'reparation-pc'
);

insert into public.services (name, slug)
select 'Réparation trottinette', 'reparation-trottinette'
where not exists (
  select 1
  from public.services
  where slug = 'reparation-trottinette'
);

insert into public.services (name, slug)
select 'Réparation vélo', 'reparation-velo'
where not exists (
  select 1
  from public.services
  where slug = 'reparation-velo'
);

insert into public.services (name, slug)
select 'Repassage', 'repassage'
where not exists (
  select 1
  from public.services
  where slug = 'repassage'
);

insert into public.services (name, slug)
select 'Ressources humaines', 'ressources-humaines'
where not exists (
  select 1
  from public.services
  where slug = 'ressources-humaines'
);

insert into public.services (name, slug)
select 'Retouche photo', 'retouche-photo'
where not exists (
  select 1
  from public.services
  where slug = 'retouche-photo'
);

insert into public.services (name, slug)
select 'Retouches vêtements', 'retouches-vetements'
where not exists (
  select 1
  from public.services
  where slug = 'retouches-vetements'
);

insert into public.services (name, slug)
select 'Saisie de données', 'saisie-de-donnees'
where not exists (
  select 1
  from public.services
  where slug = 'saisie-de-donnees'
);

insert into public.services (name, slug)
select 'Sauvegarde de données', 'sauvegarde-de-donnees'
where not exists (
  select 1
  from public.services
  where slug = 'sauvegarde-de-donnees'
);

insert into public.services (name, slug)
select 'SEA', 'sea'
where not exists (
  select 1
  from public.services
  where slug = 'sea'
);

insert into public.services (name, slug)
select 'Secrétariat', 'secretariat'
where not exists (
  select 1
  from public.services
  where slug = 'secretariat'
);

insert into public.services (name, slug)
select 'Sécurité événementielle', 'securite-evenementielle'
where not exists (
  select 1
  from public.services
  where slug = 'securite-evenementielle'
);

insert into public.services (name, slug)
select 'Sécurité incendie', 'securite-incendie'
where not exists (
  select 1
  from public.services
  where slug = 'securite-incendie'
);

insert into public.services (name, slug)
select 'SEO', 'seo'
where not exists (
  select 1
  from public.services
  where slug = 'seo'
);

insert into public.services (name, slug)
select 'Serveur', 'serveur'
where not exists (
  select 1
  from public.services
  where slug = 'serveur'
);

insert into public.services (name, slug)
select 'Serveur événementiel', 'serveur-evenementiel'
where not exists (
  select 1
  from public.services
  where slug = 'serveur-evenementiel'
);

insert into public.services (name, slug)
select 'Service client', 'service-client'
where not exists (
  select 1
  from public.services
  where slug = 'service-client'
);

insert into public.services (name, slug)
select 'Shopify', 'shopify'
where not exists (
  select 1
  from public.services
  where slug = 'shopify'
);

insert into public.services (name, slug)
select 'Silicone et étanchéité', 'silicone-et-etancheite'
where not exists (
  select 1
  from public.services
  where slug = 'silicone-et-etancheite'
);

insert into public.services (name, slug)
select 'Social media manager', 'social-media-manager'
where not exists (
  select 1
  from public.services
  where slug = 'social-media-manager'
);

insert into public.services (name, slug)
select 'Soins du visage', 'soins-du-visage'
where not exists (
  select 1
  from public.services
  where slug = 'soins-du-visage'
);

insert into public.services (name, slug)
select 'Sonorisation', 'sonorisation'
where not exists (
  select 1
  from public.services
  where slug = 'sonorisation'
);

insert into public.services (name, slug)
select 'Sortie d''école', 'sortie-d-ecole'
where not exists (
  select 1
  from public.services
  where slug = 'sortie-d-ecole'
);

insert into public.services (name, slug)
select 'Soudure', 'soudure'
where not exists (
  select 1
  from public.services
  where slug = 'soudure'
);

insert into public.services (name, slug)
select 'Sourcils', 'sourcils'
where not exists (
  select 1
  from public.services
  where slug = 'sourcils'
);

insert into public.services (name, slug)
select 'Soutien parental', 'soutien-parental'
where not exists (
  select 1
  from public.services
  where slug = 'soutien-parental'
);

insert into public.services (name, slug)
select 'Soutien scolaire', 'soutien-scolaire'
where not exists (
  select 1
  from public.services
  where slug = 'soutien-scolaire'
);

insert into public.services (name, slug)
select 'Stratégie marketing', 'strategie-marketing'
where not exists (
  select 1
  from public.services
  where slug = 'strategie-marketing'
);

insert into public.services (name, slug)
select 'Stretching', 'stretching'
where not exists (
  select 1
  from public.services
  where slug = 'stretching'
);

insert into public.services (name, slug)
select 'Studio d''enregistrement', 'studio-d-enregistrement'
where not exists (
  select 1
  from public.services
  where slug = 'studio-d-enregistrement'
);

insert into public.services (name, slug)
select 'Styliste', 'styliste'
where not exists (
  select 1
  from public.services
  where slug = 'styliste'
);

insert into public.services (name, slug)
select 'Support informatique', 'support-informatique'
where not exists (
  select 1
  from public.services
  where slug = 'support-informatique'
);

insert into public.services (name, slug)
select 'Surveillance de site', 'surveillance-de-site'
where not exists (
  select 1
  from public.services
  where slug = 'surveillance-de-site'
);

insert into public.services (name, slug)
select 'Tableau électrique', 'tableau-electrique'
where not exists (
  select 1
  from public.services
  where slug = 'tableau-electrique'
);

insert into public.services (name, slug)
select 'Taille de haies', 'taille-de-haies'
where not exists (
  select 1
  from public.services
  where slug = 'taille-de-haies'
);

insert into public.services (name, slug)
select 'Téléprospection', 'teleprospection'
where not exists (
  select 1
  from public.services
  where slug = 'teleprospection'
);

insert into public.services (name, slug)
select 'Tenue de livres', 'tenue-de-livres'
where not exists (
  select 1
  from public.services
  where slug = 'tenue-de-livres'
);

insert into public.services (name, slug)
select 'Terrasse', 'terrasse'
where not exists (
  select 1
  from public.services
  where slug = 'terrasse'
);

insert into public.services (name, slug)
select 'Terrassement', 'terrassement'
where not exists (
  select 1
  from public.services
  where slug = 'terrassement'
);

insert into public.services (name, slug)
select 'Toilettage chat', 'toilettage-chat'
where not exists (
  select 1
  from public.services
  where slug = 'toilettage-chat'
);

insert into public.services (name, slug)
select 'Toilettage chien', 'toilettage-chien'
where not exists (
  select 1
  from public.services
  where slug = 'toilettage-chien'
);

insert into public.services (name, slug)
select 'Toiture', 'toiture'
where not exists (
  select 1
  from public.services
  where slug = 'toiture'
);

insert into public.services (name, slug)
select 'Tonte de pelouse', 'tonte-de-pelouse'
where not exists (
  select 1
  from public.services
  where slug = 'tonte-de-pelouse'
);

insert into public.services (name, slug)
select 'Traducteur', 'traducteur'
where not exists (
  select 1
  from public.services
  where slug = 'traducteur'
);

insert into public.services (name, slug)
select 'Traduction', 'traduction'
where not exists (
  select 1
  from public.services
  where slug = 'traduction'
);

insert into public.services (name, slug)
select 'Traiteur', 'traiteur'
where not exists (
  select 1
  from public.services
  where slug = 'traiteur'
);

insert into public.services (name, slug)
select 'Transcription', 'transcription'
where not exists (
  select 1
  from public.services
  where slug = 'transcription'
);

insert into public.services (name, slug)
select 'Transport d''animaux', 'transport-d-animaux'
where not exists (
  select 1
  from public.services
  where slug = 'transport-d-animaux'
);

insert into public.services (name, slug)
select 'Transport de colis', 'transport-de-colis'
where not exists (
  select 1
  from public.services
  where slug = 'transport-de-colis'
);

insert into public.services (name, slug)
select 'Transport de marchandises', 'transport-de-marchandises'
where not exists (
  select 1
  from public.services
  where slug = 'transport-de-marchandises'
);

insert into public.services (name, slug)
select 'Transport de meubles', 'transport-de-meubles'
where not exists (
  select 1
  from public.services
  where slug = 'transport-de-meubles'
);

insert into public.services (name, slug)
select 'Transport express', 'transport-express'
where not exists (
  select 1
  from public.services
  where slug = 'transport-express'
);

insert into public.services (name, slug)
select 'Tresses', 'tresses'
where not exists (
  select 1
  from public.services
  where slug = 'tresses'
);

insert into public.services (name, slug)
select 'UI designer', 'ui-designer'
where not exists (
  select 1
  from public.services
  where slug = 'ui-designer'
);

insert into public.services (name, slug)
select 'UX designer', 'ux-designer'
where not exists (
  select 1
  from public.services
  where slug = 'ux-designer'
);

insert into public.services (name, slug)
select 'Veilleur de nuit', 'veilleur-de-nuit'
where not exists (
  select 1
  from public.services
  where slug = 'veilleur-de-nuit'
);

insert into public.services (name, slug)
select 'Ventilation', 'ventilation'
where not exists (
  select 1
  from public.services
  where slug = 'ventilation'
);

insert into public.services (name, slug)
select 'Vidange', 'vidange'
where not exists (
  select 1
  from public.services
  where slug = 'vidange'
);

insert into public.services (name, slug)
select 'Vidéaste', 'videaste'
where not exists (
  select 1
  from public.services
  where slug = 'videaste'
);

insert into public.services (name, slug)
select 'Vidéaste événementiel', 'videaste-evenementiel'
where not exists (
  select 1
  from public.services
  where slug = 'videaste-evenementiel'
);

insert into public.services (name, slug)
select 'Vidéaste mariage', 'videaste-mariage'
where not exists (
  select 1
  from public.services
  where slug = 'videaste-mariage'
);

insert into public.services (name, slug)
select 'Vide-maison', 'vide-maison'
where not exists (
  select 1
  from public.services
  where slug = 'vide-maison'
);

insert into public.services (name, slug)
select 'Visite d''animaux à domicile', 'visite-d-animaux-a-domicile'
where not exists (
  select 1
  from public.services
  where slug = 'visite-d-animaux-a-domicile'
);

insert into public.services (name, slug)
select 'Visite de logement', 'visite-de-logement'
where not exists (
  select 1
  from public.services
  where slug = 'visite-de-logement'
);

insert into public.services (name, slug)
select 'Vitrier', 'vitrier'
where not exists (
  select 1
  from public.services
  where slug = 'vitrier'
);

insert into public.services (name, slug)
select 'VMC', 'vmc'
where not exists (
  select 1
  from public.services
  where slug = 'vmc'
);

insert into public.services (name, slug)
select 'Voix off', 'voix-off'
where not exists (
  select 1
  from public.services
  where slug = 'voix-off'
);

insert into public.services (name, slug)
select 'Wedding planner', 'wedding-planner'
where not exists (
  select 1
  from public.services
  where slug = 'wedding-planner'
);

insert into public.services (name, slug)
select 'WordPress', 'wordpress'
where not exists (
  select 1
  from public.services
  where slug = 'wordpress'
);

-- KLYX_UNIVERSAL_CATALOG_VERIFY_14_16
select count(*) as total_services_klyx
from public.services;

select id, name, slug
from public.services
where slug in (
  'baby-sitting',
  'menage-a-domicile',
  'demenagement',
  'plombier',
  'electricien',
  'developpeur-web',
  'photographe',
  'comptable',
  'autre-metier-ou-prestation'
)
order by name;

commit;
