import { usePostHog } from "@posthog/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CircleAlert } from "lucide-react";
import { useState } from "react";
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
	AlertDialogTrigger,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import { mySkillKeys } from "#/features/account/query";
import { deleteSkill } from "#/features/skills/data";
import { skillKeys } from "#/features/skills/query";

/**
 * The permanent delete, behind a modal confirmation.
 *
 * The modal traps focus and stays open on a failure so the user can retry or
 * cancel. A success settles every read the delete can make stale, then returns
 * to the list with the confirmation carried in the URL.
 */
export function DeleteSkillDialog({ slug }: { slug: string }) {
	const [open, setOpen] = useState(false);
	const [failure, setFailure] = useState<string | undefined>(undefined);
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const posthog = usePostHog();

	const mutation = useMutation({
		mutationFn: () => deleteSkill({ data: { slug } }),
		onSuccess: async (result) => {
			if (!result.ok) {
				setFailure(result.message);
				return;
			}

			posthog.capture("skill_deleted", { slug });

			await queryClient.invalidateQueries({ queryKey: skillKeys.all });
			await queryClient.invalidateQueries({ queryKey: mySkillKeys.list() });
			await queryClient.invalidateQueries({
				queryKey: mySkillKeys.overview(),
			});

			setOpen(false);
			await navigate({ to: "/account/skills", search: { deleted: slug } });
		},
	});

	return (
		<AlertDialog
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) {
					setFailure(undefined);
				}
			}}
			open={open}
		>
			<AlertDialogTrigger asChild>
				<Button variant="destructive">Delete skill</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete this skill?</AlertDialogTitle>
					<AlertDialogDescription>
						This removes the skill for good. Anyone following its link will see
						a not found page.
					</AlertDialogDescription>
				</AlertDialogHeader>

				{failure === undefined ? null : (
					<Alert variant="destructive">
						<CircleAlert aria-hidden="true" />
						<AlertTitle>The skill could not be deleted</AlertTitle>
						<AlertDescription>{failure}</AlertDescription>
					</Alert>
				)}

				<AlertDialogFooter>
					<AlertDialogCancel>Keep skill</AlertDialogCancel>
					<AlertDialogAction
						disabled={mutation.isPending}
						onClick={(event) => {
							event.preventDefault();
							mutation.mutate();
						}}
					>
						{mutation.isPending ? "Deleting" : "Delete skill"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
