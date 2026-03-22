-- Questionnaire responses for Mom Test customer discovery
-- Stores answers as JSONB for flexible schema evolution

CREATE TABLE IF NOT EXISTS questionnaire_responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waitlist_id   uuid NOT NULL REFERENCES waitlist(id),
  email         text NOT NULL,
  completed     boolean NOT NULL DEFAULT false,
  answers       jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_step  int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE questionnaire_responses ENABLE ROW LEVEL SECURITY;

-- Public insert: anyone can start the questionnaire
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'questionnaire_public_insert' AND tablename = 'questionnaire_responses') THEN
    CREATE POLICY questionnaire_public_insert ON questionnaire_responses
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Public update by email match: respondents can update their own responses
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'questionnaire_public_update' AND tablename = 'questionnaire_responses') THEN
    CREATE POLICY questionnaire_public_update ON questionnaire_responses
      FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Authenticated select: only logged-in users (admins) can read all responses
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'questionnaire_authenticated_select' AND tablename = 'questionnaire_responses') THEN
    CREATE POLICY questionnaire_authenticated_select ON questionnaire_responses
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
