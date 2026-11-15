import { useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar, Breadcrumbs, Button, Card, Description, Input, Label, ListBox, Select, Switch, TextField } from "@heroui/react";
import { IconBell, IconCode, IconFingerprint, IconKey, IconMenu2, IconSearch, IconShield, IconUser, IconFilter, IconGauge } from "@tabler/icons-react";
import { AppSection } from "@components/ui/app-section";
import { DashboardLayout } from "@components/ui/dashboard-layout";
import { SidebarNavigation } from "@components/ui/sidebar-navigation";

const examples = [
	{
		id: "security",
		label: "Organization / Security",
		title: "Organization security",
		description: "",
		note: "Proposed AppSection owns the card and requires an icon, title and description. Only its controls and local actions vary.",
	},
	{
		id: "account",
		label: "Account / Settings",
		title: "Account settings",
		description: "Manage how your name appears in this instance.",
		note: "Current Profile has no icon or subtitle. Proposed Profile and Security and passkeys both use AppSection: matching icons, titles, subtitles and spacing.",
	},
	{
		id: "protection",
		label: "Organization / Request protection",
		title: "Request protection",
		description: "",
		note: "All three proposed settings cards require the same icon, title and description pattern. The rule controls are supplied as content.",
	},
] as const;

type ExampleId = (typeof examples)[number]["id"];

type PickProps = {
	label: string;
	value: string;
	options: readonly { id: string; label: string }[];
	onChange: (value: string) => void;
};

function Pick({ label, value, options, onChange }: PickProps) {
	return (
		<Select aria-label={label} variant='secondary' value={value} onChange={(key) => onChange(String(key))}>
			<Label>{label}</Label>
			<Select.Trigger>
				<Select.Value />
				<Select.Indicator />
			</Select.Trigger>
			<Select.Popover>
				<ListBox>
					{options.map((item) => (
						<ListBox.Item key={item.id} id={item.id}>
							{item.label}
							<ListBox.ItemIndicator />
						</ListBox.Item>
					))}
				</ListBox>
			</Select.Popover>
		</Select>
	);
}

function ComparisonSection({ proposed, currentHeading, ...props }: Parameters<typeof AppSection>[0] & { proposed: boolean; currentHeading?: ReactNode }) {
	if (proposed) return <AppSection {...props} />;

	return (
		<Card className={props.className}>
			{currentHeading}
			<Card.Content>{props.children}</Card.Content>
			{props.footer && <Card.Footer className='border-border justify-end border-t pt-4'>{props.footer}</Card.Footer>}
		</Card>
	);
}

function SettingsContent({ id, proposed }: { id: ExampleId; proposed: boolean }) {
	const [required, setRequired] = useState(false);

	if (id === "security")
		return (
			<ComparisonSection
				proposed={proposed}
				className='max-w-2xl'
				title='Passkeys'
				description='Set passkey requirements for members of this organization.'
				icon={<IconKey size={20} />}
				currentHeading={
					<Card.Header className='flex-row items-center gap-3'>
						<IconKey size={22} className='text-accent shrink-0' />
						<Card.Title>Passkeys</Card.Title>
					</Card.Header>
				}
				footer={
					<Button className='w-full sm:w-auto' isDisabled>
						Save security policy
					</Button>
				}
			>
				<Switch className='w-full' isSelected={required} onChange={setRequired}>
					<Switch.Content className='w-full justify-between gap-4'>
						<Label className='text-left'>Require a registered passkey</Label>
						<Switch.Control className='shrink-0'>
							<Switch.Thumb />
						</Switch.Control>
					</Switch.Content>
					<Description className='mt-1 ps-0'>Members need a passkey on their account to access this organization.</Description>
				</Switch>
				<p className='text-muted mt-4 text-sm'>Email-code sign-in stays available. This policy requires enrollment, not an extra sign-in step.</p>
				<Button variant='secondary' size='sm' className='mt-3' isDisabled>
					Manage your passkeys
				</Button>
			</ComparisonSection>
		);
	if (id === "account")
		return (
			<>
				<Button variant='ghost' className='text-accent w-fit p-0' isDisabled>
					Manage personal API keys
				</Button>
				<ComparisonSection proposed={proposed} title='Profile' description='Manage your display name and account details.' icon={<IconUser size={20} />}>
					<div className='flex flex-col gap-5'>
						<TextField defaultValue='Alex Morgan'>
							<Label>Display name</Label>
							<Input variant='secondary' autoComplete='off' />
						</TextField>
						<TextField defaultValue='alex@example.test' isReadOnly>
							<Label>Email address</Label>
							<Input variant='secondary' />
						</TextField>
						<p className='text-muted text-sm'>Sign in with a one-time email code. Email changes are not available.</p>
						<Button className='self-start' isDisabled>
							Save changes
						</Button>
					</div>
				</ComparisonSection>
				<ComparisonSection
					proposed={proposed}
					title='Security and passkeys'
					description='Sign in with your device or security key. Email codes remain available for recovery.'
					icon={<IconFingerprint size={20} />}
					currentHeading={
						<Card.Header>
							<h2 className='flex items-center gap-2 text-xl font-semibold'>
								<IconFingerprint size={20} />
								Security and passkeys
							</h2>
							<Card.Description>Sign in with your device or security key. Email codes remain available for recovery.</Card.Description>
						</Card.Header>
					}
				>
					<div className='flex flex-col gap-4'>
						<p className='text-muted text-sm'>No passkeys registered yet.</p>
						<TextField>
							<Label>Passkey name</Label>
							<Input variant='secondary' autoComplete='off' />
						</TextField>
						<Button variant='secondary' className='self-center sm:self-start' isDisabled>
							<IconFingerprint size={18} />
							Add passkey
						</Button>
					</div>
				</ComparisonSection>
			</>
		);

	return (
		<>
			{[
				{
					title: "Inherited protection",
					description: "Review rules applied by parent resources.",
					icon: <IconShield size={20} />,
					detail: "No inherited request filters or rate limits.",
					action: undefined,
				},
				{
					title: "Request filters",
					description: "Choose which requests this resource accepts or blocks.",
					icon: <IconFilter size={20} />,
					detail: "No request filters configured.",
					action: "Add rule",
				},
				{
					title: "Rate limits",
					description: "Control how many requests a sender can make.",
					icon: <IconGauge size={20} />,
					detail: "No rate limits configured.",
					action: "Add rate limit",
				},
			].map((section) => {
				const actions = section.action ? (
					<Button variant='secondary' size='sm' isDisabled>
						{section.action}
					</Button>
				) : undefined;

				return (
					<ComparisonSection
						key={section.title}
						proposed={proposed}
						title={section.title}
						description={section.description}
						icon={section.icon}
						actions={actions}
						currentHeading={
							<Card.Header className='flex flex-row flex-wrap items-center justify-between gap-3'>
								<Card.Title>{section.title}</Card.Title>
								{actions}
							</Card.Header>
						}
					>
						<p className='text-muted text-sm'>{section.detail}</p>
					</ComparisonSection>
				);
			})}
		</>
	);
}

export function SubpageExample() {
	const params = new URLSearchParams(location.search);
	const example = examples.find((item) => item.id === params.get("example")) ?? examples[0];
	const proposed = params.get("version") !== "current";
	const marked = params.get("marks") !== "0";

	const [open, setOpen] = useState(false);

	const title = (
		<>
			<h1 className='text-3xl font-semibold'>{example.title}</h1>
			{example.description && <p className='text-muted mt-2'>{example.description}</p>}
		</>
	);
	const action =
		example.id === "protection" ? (
			<Button variant='secondary' isDisabled>
				Test request
			</Button>
		) : undefined;
	const heading = proposed ? (
		<header className='sc-page-heading' data-new-heading>
			<div>{title}</div>
			{action}
		</header>
	) : (
		<header className={action ? "flex flex-wrap items-start justify-between gap-3" : undefined}>
			<div>{title}</div>
			{action}
		</header>
	);

	return (
		<div className='sc-example' data-marks={marked ? "true" : undefined} data-version={proposed ? "proposed" : "current"}>
			<DashboardLayout
				open={open}
				onOpenChange={setOpen}
				onClosed={() => {}}
				navigationLabel='Existing shared navigation'
				background='var(--background)'
				brand='Payload Bay'
				header={(toggle) => (
					<>
						<Button isIconOnly variant='ghost' aria-label='Toggle navigation' onPress={toggle}>
							<IconMenu2 size={20} />
						</Button>
						<img src='./layout-brand.svg' alt='Payload Bay' className='pl-brand' />
						<div className='ml-auto flex items-center gap-2'>
							<Button isIconOnly variant='ghost' aria-label='Notifications' isDisabled>
								<IconBell size={20} />
							</Button>
							<Avatar size='sm'>
								<Avatar.Fallback>AM</Avatar.Fallback>
							</Avatar>
						</div>
					</>
				)}
				navigation={(collapsed) => (
					<>
						<div className='pl-nav-search'>
							<Button variant='secondary' className='w-full justify-start' isDisabled>
								<IconSearch size={18} />
								{!collapsed && "Search…"}
							</Button>
						</div>
						<SidebarNavigation
							title={example.id === "account" ? "Account" : "Acme"}
							collapsed={collapsed}
							label='Existing shared navigation'
							activeId={example.id}
							groups={
								example.id === "account"
									? [
											{
												label: "Settings",
												items: [
													{
														id: "account",
														label: "Account settings",
														href: "#account",
														icon: <IconFingerprint size={18} />,
													},
													{
														id: "notifications",
														label: "Notification settings",
														href: "#notifications",
														icon: <IconBell size={18} />,
													},
													{
														id: "api-keys",
														label: "Personal API keys",
														href: "#api-keys",
														icon: <IconKey size={18} />,
													},
												],
											},
										]
									: [
											{
												label: "Settings",
												items: [
													{
														id: "security",
														label: "Organization security",
														href: "#security",
														icon: <IconShield size={18} />,
													},
													{
														id: "protection",
														label: "Request protection",
														href: "#protection",
														icon: <IconShield size={18} />,
													},
													{
														id: "code",
														label: "Code and middleware",
														href: "#code",
														icon: <IconCode size={18} />,
													},
												],
											},
										]
							}
							onNavigate={(event) => event.preventDefault()}
						/>
					</>
				)}
			>
				<main className='sc-main'>
					<nav className='sc-breadcrumbs' aria-label='Breadcrumbs'>
						<Breadcrumbs>
							<Breadcrumbs.Item>Overview</Breadcrumbs.Item>
							{example.id !== "account" && <Breadcrumbs.Item>Acme</Breadcrumbs.Item>}
							<Breadcrumbs.Item>{example.id === "account" ? "Account settings" : example.id === "security" ? "Security" : "Request protection"}</Breadcrumbs.Item>
						</Breadcrumbs>
					</nav>
					<section className={`sc-subpage ${example.id === "account" ? "sc-account" : ""}`} data-subpage>
						{heading}
						<SettingsContent id={example.id} proposed={proposed} />
					</section>
				</main>
			</DashboardLayout>
		</div>
	);
}

type FitPreviewProps = {
	id: string;
	version: string;
	marks: boolean;
	device: string;
};

function FitPreview({ id, version, marks, device }: FitPreviewProps) {
	const container = useRef<HTMLDivElement>(null);
	const [available, setAvailable] = useState(600);

	useEffect(() => {
		if (!container.current) return;
		const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width));
		observer.observe(container.current);

		return () => observer.disconnect();
	}, []);

	const width = device === "mobile" ? 390 : 1100;
	const scale = Math.min(1, available / width);

	return (
		<div ref={container} className='sc-iframe-track' style={{ height: 1050 * scale }}>
			<iframe
				title={`${version} subpage`}
				src={`?subpage=1&example=${id}&version=${version}&marks=${marks ? 1 : 0}`}
				style={{
					width,
					transform: `scale(${scale})`,
					transformOrigin: "top left",
					marginLeft: Math.max(0, (available - width * scale) / 2),
				}}
			/>
		</div>
	);
}

export function SubpageComparison() {
	const [id, setId] = useState("account");
	const [mode, setMode] = useState("side");
	const [device, setDevice] = useState("desktop");
	const [marks, setMarks] = useState(true);

	const selected = examples.find((item) => item.id === id)!;
	const versions = mode === "side" ? ["current", "proposed"] : [mode];

	return (
		<div className='pl-workbench'>
			<header>
				<h1 className='text-xl font-semibold'>Subpage consistency / current and proposed</h1>
				<p className='text-muted mt-2 text-sm'>The outer shell already exists. Compare only the page and card sections beneath it.</p>
			</header>
			<div className='pl-review-controls'>
				<Pick label='Actual subpage' value={id} options={examples} onChange={setId} />
				<Pick
					label='Compare'
					value={mode}
					options={[
						{ id: "side", label: "Current / proposed side by side" },
						{ id: "current", label: "Current only" },
						{ id: "proposed", label: "Proposed only" },
					]}
					onChange={setMode}
				/>
				<Pick
					label='Viewport'
					value={device}
					options={[
						{ id: "desktop", label: "Desktop / scaled to fit" },
						{ id: "mobile", label: "Mobile / 390 px" },
					]}
					onChange={setDevice}
				/>
			</div>
			<div className='sc-key'>
				<Switch isSelected={marks} onChange={setMarks}>
					<Switch.Control>
						<Switch.Thumb />
					</Switch.Control>
					<Switch.Content>
						<Label>Show layout boundaries</Label>
					</Switch.Content>
				</Switch>
				<span>
					<i className='sc-key-existing' />
					Gray dotted: existing shared shell
				</span>
				<span>
					<i className='sc-key-new' />
					Blue dashed: shared AppSection headers
				</span>
			</div>
			<p className='text-muted text-sm'>{selected.note}</p>
			<div className={`sc-comparison ${mode === "side" ? "sc-two" : ""}`}>
				{versions.map((version) => (
					<section className='sc-column' key={version}>
						<header>
							<h2 className='font-semibold'>{version === "current" ? "Current / independently assembled sections" : "Proposed / shared page and section structure"}</h2>
							<a href={`?subpage=1&example=${id}&version=${version}&marks=${marks ? 1 : 0}`} className='button button--ghost button--sm' target='_blank' rel='noreferrer'>
								Open full width
							</a>
						</header>
						<FitPreview id={id} version={version} marks={marks} device={device} />
					</section>
				))}
			</div>
			<p className='text-muted text-sm'>Presentation mockup using the current subpage compositions and synthetic account data. Non-layout actions are disabled; nothing is saved. Gray-marked chrome is shared on both sides. Login, usage and unrelated examples are intentionally excluded.</p>
		</div>
	);
}
