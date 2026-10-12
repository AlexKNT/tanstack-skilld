import { useUser } from "@clerk/tanstack-react-start";
import { usePostHog } from "@posthog/react";
import { CircleAlert, Upload } from "lucide-react";
import { useId, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import { Spinner } from "#/components/ui/spinner";
import { publishFieldControlClass } from "#/features/skills/components/publish-form-field";

/** The image types the browser check accepts before Clerk sees the file. */
const ALLOWED_IMAGE_TYPES = [
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/gif",
] as const;

/** The largest photo the browser check allows, matching Clerk's limit. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const GENERIC_ERROR = "Something went wrong. Please try again.";
const CODE_NOT_RIGHT = "That code is not right.";
const CODE_EXPIRED = "That code has expired. Send a new one.";
const EMAIL_IN_USE = "That email address is already in use.";

/** Reads the Clerk error code from whatever shape an error arrived in. */
function clerkErrorCode(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null) {
		return undefined;
	}

	const errors = (error as { errors?: unknown }).errors;
	if (!Array.isArray(errors) || errors.length === 0) {
		return undefined;
	}

	const first = errors[0] as { code?: unknown };
	return typeof first.code === "string" ? first.code : undefined;
}

/** Reads Clerk's own message, so an unmapped error still says something real. */
function clerkErrorMessage(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null) {
		return undefined;
	}

	const errors = (error as { errors?: unknown }).errors;
	if (!Array.isArray(errors) || errors.length === 0) {
		return undefined;
	}

	const first = errors[0] as { longMessage?: unknown; message?: unknown };
	if (typeof first.longMessage === "string") {
		return first.longMessage;
	}
	return typeof first.message === "string" ? first.message : undefined;
}

/** Maps the three email failures the spec names, else Clerk's own message. */
function emailErrorMessage(error: unknown): string {
	const code = clerkErrorCode(error);

	if (code !== undefined) {
		if (code.includes("incorrect")) {
			return CODE_NOT_RIGHT;
		}
		if (code.includes("expired")) {
			return CODE_EXPIRED;
		}
		if (code.includes("identifier_exists") || code.includes("already")) {
			return EMAIL_IN_USE;
		}
	}

	return clerkErrorMessage(error) ?? GENERIC_ERROR;
}

/** The profile page's three sections: name, photo, and email address. */
export function ProfileForms() {
	const { isLoaded, user } = useUser();

	if (!isLoaded || !user) {
		return (
			<div aria-hidden="true" className="flex flex-col gap-6">
				<Skeleton className="h-52 w-full rounded-xl" />
				<Skeleton className="h-40 w-full rounded-xl" />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<NameSection
				initialFirstName={user.firstName ?? ""}
				initialLastName={user.lastName ?? ""}
			/>
			<PhotoSection
				imageUrl={user.imageUrl}
				initials={initialsOf(user.fullName ?? "")}
			/>
			<EmailSection primaryEmail={user.primaryEmailAddress?.emailAddress} />
		</div>
	);
}

function initialsOf(name: string): string {
	return name
		.trim()
		.split(/\s+/)
		.filter((part) => part !== "")
		.slice(0, 2)
		.map((part) => part.charAt(0).toUpperCase())
		.join("");
}

/** The name section: first and last name, saved through Clerk. */
function NameSection({
	initialFirstName,
	initialLastName,
}: {
	initialFirstName: string;
	initialLastName: string;
}) {
	const { user } = useUser();
	const posthog = usePostHog();
	const formId = useId();

	const [firstName, setFirstName] = useState(initialFirstName);
	const [lastName, setLastName] = useState(initialLastName);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | undefined>(undefined);
	const [saved, setSaved] = useState(false);

	async function handleSubmit(
		event: React.FormEvent<HTMLFormElement>,
	): Promise<void> {
		event.preventDefault();
		if (!user || pending) {
			return;
		}

		setPending(true);
		setError(undefined);
		setSaved(false);

		try {
			await user.update({
				firstName: firstName.trim(),
				lastName: lastName.trim(),
			});
			setSaved(true);
			posthog.capture("profile_updated", { field: "name" });
		} catch (caught) {
			setError(clerkErrorMessage(caught) ?? "Your name could not be saved.");
		} finally {
			setPending(false);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<h2 className="text-base font-semibold">Name</h2>
				</CardTitle>
			</CardHeader>
			<CardContent>
				<form
					className="flex flex-col gap-4"
					noValidate
					onSubmit={handleSubmit}
				>
					<div className="flex flex-col gap-2">
						<label className="text-sm font-medium" htmlFor={`${formId}-first`}>
							First name
						</label>
						<input
							className={publishFieldControlClass}
							id={`${formId}-first`}
							onChange={(event) => setFirstName(event.target.value)}
							value={firstName}
						/>
					</div>
					<div className="flex flex-col gap-2">
						<label className="text-sm font-medium" htmlFor={`${formId}-last`}>
							Last name
						</label>
						<input
							className={publishFieldControlClass}
							id={`${formId}-last`}
							onChange={(event) => setLastName(event.target.value)}
							value={lastName}
						/>
					</div>
					<div className="flex items-center gap-3">
						<Button disabled={pending} type="submit">
							{pending ? (
								<Spinner aria-hidden="true" data-icon="inline-start" />
							) : null}
							Save name
						</Button>
						<SavedMessage saved={saved} />
					</div>
					{error === undefined ? null : <ErrorText message={error} />}
				</form>
			</CardContent>
		</Card>
	);
}

/** The photo section: a browser checked image, uploaded through Clerk. */
function PhotoSection({
	imageUrl,
	initials,
}: {
	imageUrl: string;
	initials: string;
}) {
	const { user } = useUser();
	const posthog = usePostHog();
	const inputId = useId();

	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | undefined>(undefined);
	const [saved, setSaved] = useState(false);

	async function handleFile(
		event: React.ChangeEvent<HTMLInputElement>,
	): Promise<void> {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (file === undefined || !user) {
			return;
		}

		setError(undefined);
		setSaved(false);

		if (
			!ALLOWED_IMAGE_TYPES.includes(
				file.type as (typeof ALLOWED_IMAGE_TYPES)[number],
			)
		) {
			setError("Choose a PNG, JPEG, WebP, or GIF image.");
			return;
		}

		if (file.size > MAX_IMAGE_BYTES) {
			setError("Choose an image of 5 MB or smaller.");
			return;
		}

		setPending(true);
		try {
			await user.setProfileImage({ file });
			setSaved(true);
			posthog.capture("profile_updated", { field: "photo" });
		} catch (caught) {
			setError(clerkErrorMessage(caught) ?? "Your photo could not be saved.");
		} finally {
			setPending(false);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<h2 className="text-base font-semibold">Photo</h2>
				</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<div className="flex items-center gap-4">
					<Avatar size="lg">
						{imageUrl === "" ? null : <AvatarImage alt="" src={imageUrl} />}
						<AvatarFallback>{initials}</AvatarFallback>
					</Avatar>
					<div className="flex flex-col gap-2">
						<label className="text-sm font-medium" htmlFor={inputId}>
							Choose a new photo
						</label>
						<input
							accept={ALLOWED_IMAGE_TYPES.join(",")}
							aria-describedby={`${inputId}-hint`}
							className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-transparent file:px-3 file:py-1.5 file:text-sm"
							disabled={pending}
							id={inputId}
							onChange={handleFile}
							type="file"
						/>
						<p className="text-sm text-muted-foreground" id={`${inputId}-hint`}>
							PNG, JPEG, WebP, or GIF, up to 5 MB.
						</p>
					</div>
				</div>
				<div className="flex items-center gap-3">
					{pending ? (
						<p className="flex items-center gap-2 text-sm text-muted-foreground">
							<Upload aria-hidden="true" className="size-4" />
							Uploading…
						</p>
					) : null}
					<SavedMessage saved={saved} />
				</div>
				{error === undefined ? null : <ErrorText message={error} />}
			</CardContent>
		</Card>
	);
}

/** The email section: add an address, verify a code, then make it primary. */
function EmailSection({ primaryEmail }: { primaryEmail: string | undefined }) {
	const { user } = useUser();
	const posthog = usePostHog();
	const formId = useId();

	const [step, setStep] = useState<"enter" | "code" | "primary" | "done">(
		"enter",
	);
	const [email, setEmail] = useState("");
	const [code, setCode] = useState("");
	const [pendingId, setPendingId] = useState<string | undefined>(undefined);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | undefined>(undefined);

	/** Re-finds the address Clerk is currently verifying, if it still exists. */
	function pendingAddress() {
		if (!user || pendingId === undefined) {
			return undefined;
		}
		return user.emailAddresses.find((address) => address.id === pendingId);
	}

	async function sendCode(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!user || pending) {
			return;
		}

		setPending(true);
		setError(undefined);

		try {
			const created = await user.createEmailAddress({ email: email.trim() });
			await user.reload();
			const address = user.emailAddresses.find((it) => it.id === created.id);
			if (address === undefined) {
				throw new Error("address missing after creation");
			}
			await address.prepareVerification({ strategy: "email_code" });
			setPendingId(created.id);
			setStep("code");
		} catch (caught) {
			setError(emailErrorMessage(caught));
		} finally {
			setPending(false);
		}
	}

	async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const address = pendingAddress();
		if (address === undefined || pending) {
			setError("That address is no longer available. Start again.");
			return;
		}

		setPending(true);
		setError(undefined);

		try {
			await address.attemptVerification({ code: code.trim() });
			setStep("primary");
		} catch (caught) {
			setError(emailErrorMessage(caught));
		} finally {
			setPending(false);
		}
	}

	async function resendCode() {
		const address = pendingAddress();
		if (address === undefined || pending) {
			return;
		}

		setPending(true);
		setError(undefined);

		try {
			await address.prepareVerification({ strategy: "email_code" });
		} catch (caught) {
			setError(emailErrorMessage(caught));
		} finally {
			setPending(false);
		}
	}

	async function makePrimary() {
		if (!user || pendingId === undefined || pending) {
			return;
		}

		setPending(true);
		setError(undefined);

		try {
			await user.update({ primaryEmailAddressId: pendingId });
			await user.reload();
			setStep("done");
			posthog.capture("profile_updated", { field: "email" });
		} catch (caught) {
			setError(emailErrorMessage(caught));
		} finally {
			setPending(false);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<h2 className="text-base font-semibold">Email address</h2>
				</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<p className="text-sm text-muted-foreground">
					{primaryEmail === undefined
						? "No primary email address is set."
						: `Current address: ${primaryEmail}`}
				</p>

				{step === "enter" ? (
					<form className="flex flex-col gap-3" noValidate onSubmit={sendCode}>
						<div className="flex flex-col gap-2">
							<label
								className="text-sm font-medium"
								htmlFor={`${formId}-email`}
							>
								New email address
							</label>
							<input
								aria-describedby={
									error === undefined ? undefined : `${formId}-email-error`
								}
								aria-invalid={error !== undefined}
								className={publishFieldControlClass}
								id={`${formId}-email`}
								inputMode="email"
								onChange={(event) => setEmail(event.target.value)}
								type="email"
								value={email}
							/>
						</div>
						<div className="flex items-center gap-3">
							<Button disabled={pending} type="submit">
								{pending ? (
									<Spinner aria-hidden="true" data-icon="inline-start" />
								) : null}
								Send code
							</Button>
						</div>
					</form>
				) : null}

				{step === "code" ? (
					<form
						className="flex flex-col gap-3"
						noValidate
						onSubmit={verifyCode}
					>
						<p className="text-sm text-muted-foreground">
							We sent a code to {email.trim()}.
						</p>
						<div className="flex flex-col gap-2">
							<label className="text-sm font-medium" htmlFor={`${formId}-code`}>
								Verification code
							</label>
							<input
								aria-describedby={
									error === undefined ? undefined : `${formId}-code-error`
								}
								aria-invalid={error !== undefined}
								className={publishFieldControlClass}
								id={`${formId}-code`}
								inputMode="numeric"
								onChange={(event) => setCode(event.target.value)}
								value={code}
							/>
						</div>
						<div className="flex flex-wrap items-center gap-3">
							<Button disabled={pending} type="submit">
								{pending ? (
									<Spinner aria-hidden="true" data-icon="inline-start" />
								) : null}
								Verify code
							</Button>
							<Button
								disabled={pending}
								onClick={() => void resendCode()}
								type="button"
								variant="ghost"
							>
								Send a new code
							</Button>
						</div>
					</form>
				) : null}

				{step === "primary" ? (
					<div className="flex flex-col gap-3">
						<p className="text-sm text-muted-foreground">
							{email.trim()} is verified. Make it your primary address?
						</p>
						<div className="flex items-center gap-3">
							<Button
								disabled={pending}
								onClick={() => void makePrimary()}
								type="button"
							>
								{pending ? (
									<Spinner aria-hidden="true" data-icon="inline-start" />
								) : null}
								Make primary
							</Button>
						</div>
					</div>
				) : null}

				{step === "done" ? (
					<output className="text-sm">
						Your email address has been updated.
					</output>
				) : null}

				{error === undefined ? null : (
					<ErrorText
						id={step === "code" ? `${formId}-code-error` : undefined}
						message={error}
					/>
				)}
			</CardContent>
		</Card>
	);
}

/** A polite confirmation that a section saved. */
function SavedMessage({ saved }: { saved: boolean }) {
	if (!saved) {
		return null;
	}

	return <output className="text-sm text-muted-foreground">Saved</output>;
}

/** An announced error, tied to a field by id when one is given. */
function ErrorText({ id, message }: { id?: string; message: string }) {
	return (
		<Alert variant="destructive">
			<CircleAlert aria-hidden="true" />
			<AlertTitle>Something needs your attention</AlertTitle>
			<AlertDescription id={id}>{message}</AlertDescription>
		</Alert>
	);
}
