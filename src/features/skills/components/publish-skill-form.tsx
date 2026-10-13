import { usePostHog } from "@posthog/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CircleAlert, Sparkles } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Spinner } from "#/components/ui/spinner";
import type { Failure } from "#/db/result";
import { PUBLISH_PATH } from "#/features/skills/auth";
import { type CreatedSkill, createSkill } from "#/features/skills/data";
import { skillKeys } from "#/features/skills/query";
import {
	MAX_SKILL_DESCRIPTION_LENGTH,
	MAX_SKILL_NAME_LENGTH,
	MAX_SKILL_SUMMARY_LENGTH,
} from "#/features/skills/schema";
import {
	PublishFormField,
	publishFieldControlClass,
} from "./publish-form-field";

/** The four fields the form collects, in the order they are rendered. */
const FIELD_ORDER = ["name", "summary", "description", "installUrl"] as const;

type FieldName = (typeof FIELD_ORDER)[number];

/** The trimmed values the form sends, and the field each one belongs to. */
type FormValues = Record<FieldName, string>;

const EMPTY_VALUES: FormValues = {
	name: "",
	summary: "",
	description: "",
	installUrl: "",
};

/** The field's message when the server refused that value. */
type FieldErrors = Partial<Record<FieldName, string>>;

/**
 * Whether a failure's message belongs beside a field rather than in the alert.
 *
 * A validation failure names the field that caused it, so its message renders
 * under that input. Everything else (a store that is momentarily unreachable,
 * an expired session) has no field to attach to, so it belongs in the alert.
 */
function isFieldFailure(
	failure: Failure,
): failure is Failure & { field: FieldName } {
	return failure.code === "VALIDATION_FAILED" && failure.field !== undefined;
}

/**
 * The publish form: four fields in one card, saved through the existing
 * `createSkill` server function.
 *
 * The server is the only authority on validity, so the form makes no rule of
 * its own and maps a validation failure back onto the field that caused it. The
 * typed contents survive every failure and are only cleared by the redirect
 * that follows a successful save.
 */
export function PublishSkillForm() {
	const posthog = usePostHog();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const formId = useId();

	const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
	const [submitted, setSubmitted] = useState(false);
	const submittingRef = useRef(false);
	const startedRef = useRef(false);

	// One event when the form opens, with no skill fields because none exist yet.
	// The ref guard keeps it to a single capture even though React invokes an
	// effect twice per mount while developing under StrictMode.
	useEffect(() => {
		if (startedRef.current) {
			return;
		}

		startedRef.current = true;
		posthog.capture("publish_started");
	}, [posthog]);

	const mutation = useMutation({
		mutationFn: (payload: FormValues) => createSkill({ data: payload }),
		onSuccess: async (result) => {
			if (!result.ok) {
				handleFailure(result);
				return;
			}

			await handleSaved(result.value);
		},
		onSettled: () => {
			submittingRef.current = false;
		},
	});

	/** Records a refused save, splitting field errors from the general alert. */
	function handleFailure(failure: Failure): void {
		setSubmitted(true);

		if (isFieldFailure(failure)) {
			setFieldErrors({ [failure.field]: failure.message });
			return;
		}

		setFieldErrors({});
	}

	/** Captures the event, refreshes the catalogue, then leaves for the new skill. */
	async function handleSaved(skill: CreatedSkill): Promise<void> {
		posthog.capture("skill_published", {
			name: values.name,
			slug: skill.slug,
		});

		await queryClient.invalidateQueries({ queryKey: skillKeys.all });
		await navigate({ to: "/skills/$slug", params: { slug: skill.slug } });
	}

	function handleChange(field: FieldName, value: string): void {
		setValues((current) => ({ ...current, [field]: value }));
	}

	function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
		event.preventDefault();

		if (submittingRef.current || mutation.isPending) {
			return;
		}

		submittingRef.current = true;
		setFieldErrors({});
		setSubmitted(false);
		mutation.mutate(values);
	}

	function handleRetry(): void {
		handleSubmit(
			new Event("submit") as unknown as React.FormEvent<HTMLFormElement>,
		);
	}

	// A validation failure renders beside its field, so the alert is kept for the
	// failures that have no field to attach a message to.
	const alertFailure =
		submitted &&
		mutation.data !== undefined &&
		!mutation.data.ok &&
		!isFieldFailure(mutation.data)
			? mutation.data
			: undefined;
	const unauthenticated = alertFailure?.code === "UNAUTHENTICATED";

	return (
		<Card>
			<CardHeader>
				<CardTitle>Skill details</CardTitle>
			</CardHeader>
			<CardContent>
				<form
					className="flex flex-col gap-6"
					noValidate
					onSubmit={handleSubmit}
				>
					{alertFailure === undefined ? null : (
						<Alert variant="destructive">
							<CircleAlert aria-hidden="true" />
							<AlertTitle>
								{unauthenticated
									? "Please sign in again"
									: "The skill could not be published"}
							</AlertTitle>
							<AlertDescription>{alertFailure.message}</AlertDescription>
							<div className="col-start-2 mt-2">
								{unauthenticated ? (
									<Button asChild size="sm" variant="outline">
										<a
											href={`/sign-in?redirect=${encodeURIComponent(PUBLISH_PATH)}`}
										>
											Sign in
										</a>
									</Button>
								) : (
									<Button
										disabled={mutation.isPending}
										onClick={handleRetry}
										size="sm"
										type="button"
										variant="outline"
									>
										{mutation.isPending ? (
											<>
												<Spinner aria-hidden="true" data-icon="inline-start" />
												Trying
											</>
										) : (
											"Try again"
										)}
									</Button>
								)}
							</div>
						</Alert>
					)}

					<PublishFormField
						error={fieldErrors.name}
						hint={`Up to ${MAX_SKILL_NAME_LENGTH} characters.`}
						id={`${formId}-name`}
						label="Name"
					>
						{(describedBy, invalid) => (
							<input
								aria-describedby={describedBy}
								aria-invalid={invalid}
								className={publishFieldControlClass}
								id={`${formId}-name`}
								maxLength={MAX_SKILL_NAME_LENGTH * 2}
								name="name"
								onChange={(event) => handleChange("name", event.target.value)}
								required
								value={values.name}
							/>
						)}
					</PublishFormField>

					<PublishFormField
						error={fieldErrors.summary}
						hint={`One line, up to ${MAX_SKILL_SUMMARY_LENGTH} characters.`}
						id={`${formId}-summary`}
						label="Summary"
					>
						{(describedBy, invalid) => (
							<input
								aria-describedby={describedBy}
								aria-invalid={invalid}
								className={publishFieldControlClass}
								id={`${formId}-summary`}
								maxLength={MAX_SKILL_SUMMARY_LENGTH * 2}
								name="summary"
								onChange={(event) =>
									handleChange("summary", event.target.value)
								}
								required
								value={values.summary}
							/>
						)}
					</PublishFormField>

					<PublishFormField
						error={fieldErrors.description}
						hint={`Markdown is allowed. Up to ${MAX_SKILL_DESCRIPTION_LENGTH.toLocaleString(
							"en-GB",
						)} characters.`}
						id={`${formId}-description`}
						label="Description"
					>
						{(describedBy, invalid) => (
							<textarea
								aria-describedby={describedBy}
								aria-invalid={invalid}
								className={`${publishFieldControlClass} min-h-48 resize-y`}
								id={`${formId}-description`}
								name="description"
								onChange={(event) =>
									handleChange("description", event.target.value)
								}
								required
								rows={10}
								value={values.description}
							/>
						)}
					</PublishFormField>

					<PublishFormField
						error={fieldErrors.installUrl}
						hint="Optional. Must start with http:// or https://."
						id={`${formId}-installUrl`}
						label="Install URL"
					>
						{(describedBy, invalid) => (
							<input
								aria-describedby={describedBy}
								aria-invalid={invalid}
								className={publishFieldControlClass}
								id={`${formId}-installUrl`}
								inputMode="url"
								name="installUrl"
								onChange={(event) =>
									handleChange("installUrl", event.target.value)
								}
								type="url"
								value={values.installUrl}
							/>
						)}
					</PublishFormField>

					<div className="flex items-center gap-3">
						<Button
							aria-label="Publish skill"
							disabled={mutation.isPending}
							type="submit"
						>
							{mutation.isPending ? (
								<Spinner aria-hidden="true" data-icon="inline-start" />
							) : null}
							Publish skill
						</Button>
						{mutation.isPending ? (
							<p className="text-sm text-muted-foreground">
								Publishing your skill…
							</p>
						) : null}
					</div>
				</form>
			</CardContent>
		</Card>
	);
}

/** The intro band above the form card. */
export function PublishSkillIntro() {
	return (
		<header className="flex flex-col items-start gap-4">
			<span className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-medium tracking-wide text-[var(--kicker)] uppercase">
				Publish
			</span>
			<h1 className="max-w-2xl text-balance font-display text-4xl leading-tight font-bold sm:text-5xl">
				Publish a skill
			</h1>
			<p className="max-w-2xl text-lg text-muted-foreground">
				Share a skill so others can find and install it.
			</p>
			<p className="flex items-center gap-2 text-sm text-muted-foreground">
				<Sparkles
					aria-hidden="true"
					className="size-4 text-[var(--lagoon-deep)]"
				/>
				Your name is added as the publisher automatically.
			</p>
		</header>
	);
}
