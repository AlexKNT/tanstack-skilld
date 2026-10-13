import { useClerk } from "@clerk/tanstack-react-start";
import { usePostHog } from "@posthog/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBlocker, useNavigate } from "@tanstack/react-router";
import { CircleAlert } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Spinner } from "#/components/ui/spinner";
import type { Failure } from "#/db/result";
import { mySkillKeys } from "#/features/account/query";
import {
	PublishFormField,
	publishFieldControlClass,
} from "#/features/skills/components/publish-form-field";
import { type MySkill, updateSkill } from "#/features/skills/data";
import { skillKeys } from "#/features/skills/query";
import {
	MAX_SKILL_DESCRIPTION_LENGTH,
	MAX_SKILL_NAME_LENGTH,
	MAX_SKILL_SUMMARY_LENGTH,
} from "#/features/skills/schema";
import { DeleteSkillDialog } from "./delete-skill-dialog";

const FIELD_ORDER = ["name", "summary", "description", "installUrl"] as const;

type FieldName = (typeof FIELD_ORDER)[number];

type FormValues = Record<FieldName, string>;

function initialValues(skill: MySkill): FormValues {
	return {
		name: skill.name,
		summary: skill.summary,
		description: skill.description,
		installUrl: skill.installUrl ?? "",
	};
}

type FieldErrors = Partial<Record<FieldName, string>>;

function isFieldFailure(
	failure: Failure,
): failure is Failure & { field: FieldName } {
	return failure.code === "VALIDATION_FAILED" && failure.field !== undefined;
}

/**
 * The edit form: the four skill fields in one card, saved through `updateSkill`.
 *
 * The form keeps what was typed through every failure, maps a validation
 * failure back onto its field, and warns before an in app navigation would
 * throw away unsaved changes. The slug is never edited, it is the skill's URL.
 */
export function EditSkillForm({ skill }: { skill: MySkill }) {
	const posthog = usePostHog();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { openSignIn } = useClerk();
	const formId = useId();

	const [initial] = useState(() => initialValues(skill));
	const [values, setValues] = useState<FormValues>(initial);
	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
	const [submitted, setSubmitted] = useState(false);
	const submittingRef = useRef(false);
	const savedRef = useRef(false);

	const isDirty = FIELD_ORDER.some((field) => values[field] !== initial[field]);

	const blocker = useBlocker({
		shouldBlockFn: () => !savedRef.current && isDirty,
		withResolver: true,
		enableBeforeUnload: isDirty,
	});

	const mutation = useMutation({
		mutationFn: (payload: FormValues) =>
			updateSkill({ data: { slug: skill.slug, ...payload } }),
		onSuccess: async (result) => {
			setSubmitted(true);

			if (!result.ok) {
				if (isFieldFailure(result)) {
					setFieldErrors({ [result.field]: result.message });
				} else {
					setFieldErrors({});
				}
				return;
			}

			savedRef.current = true;
			posthog.capture("skill_updated", { slug: result.value.slug });

			await queryClient.invalidateQueries({ queryKey: skillKeys.all });
			await queryClient.invalidateQueries({ queryKey: mySkillKeys.list() });
			await queryClient.invalidateQueries({
				queryKey: mySkillKeys.overview(),
			});

			await navigate({
				to: "/skills/$slug",
				params: { slug: skill.slug },
			});
		},
		onSettled: () => {
			submittingRef.current = false;
		},
	});

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

	const alertFailure =
		submitted &&
		mutation.data !== undefined &&
		!mutation.data.ok &&
		!isFieldFailure(mutation.data)
			? mutation.data
			: undefined;
	const unauthenticated = alertFailure?.code === "UNAUTHENTICATED";
	const notFound = alertFailure?.code === "SKILL_NOT_FOUND";

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
									: notFound
										? "This skill is no longer available"
										: "The skill could not be saved"}
							</AlertTitle>
							<AlertDescription>{alertFailure.message}</AlertDescription>
							<div className="col-start-2 mt-2">
								{unauthenticated ? (
									<Button
										onClick={() => openSignIn()}
										size="sm"
										type="button"
										variant="outline"
									>
										Sign in to save your changes
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

					<div className="flex flex-wrap items-center justify-between gap-4">
						<div className="flex items-center gap-3">
							<Button disabled={mutation.isPending} type="submit">
								{mutation.isPending ? (
									<Spinner aria-hidden="true" data-icon="inline-start" />
								) : null}
								Save changes
							</Button>
							{mutation.isPending ? (
								<p className="text-sm text-muted-foreground">Saving…</p>
							) : null}
						</div>
						<DeleteSkillDialog slug={skill.slug} />
					</div>
				</form>
			</CardContent>

			<AlertDialog
				onOpenChange={(open) => {
					if (!open) {
						blocker.reset?.();
					}
				}}
				open={blocker.status === "blocked"}
			>
				<AlertDialogContent size="sm">
					<AlertDialogHeader>
						<AlertDialogTitle>Discard your changes?</AlertDialogTitle>
						<AlertDialogDescription>
							You have unsaved changes to this skill. Leaving now will lose
							them.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => blocker.reset?.()}>
							Keep editing
						</AlertDialogCancel>
						<AlertDialogAction onClick={() => blocker.proceed?.()}>
							Discard changes
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Card>
	);
}
