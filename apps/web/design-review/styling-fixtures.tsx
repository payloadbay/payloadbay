import { Widget, ListView } from "@components/ui/display";
import { CellColorPicker, CellSelect, CellSlider, CellSwitch, InlineSelect, NativeSelect } from "@components/ui/cell-controls";

const options = [{ id: "one", label: "One" }];
const style = { maxWidth: 237, color: "rgb(120, 80, 40)" };

export function StylingFixtures() {
	return (
		<div className='grid gap-4'>
			<Widget className='probe-widget' style={style}>
				<Widget.Header className='probe-header' style={style}>
					Header
				</Widget.Header>
				<Widget.Content className='probe-content' style={style}>
					Content
				</Widget.Content>
				<Widget.Footer className='probe-footer' style={style}>
					Footer
				</Widget.Footer>
			</Widget>
			<NativeSelect label='Native' className='probe-native' style={style}>
				<option>One</option>
			</NativeSelect>
			<NativeSelect label='Full native' fullWidth className='probe-native-full' style={{ ...style, width: 100 }}>
				<option>One</option>
			</NativeSelect>
			<InlineSelect label='Inline' options={options} className={() => "probe-inline"} style={() => style} />
			<CellSelect label='Cell' options={options} className={() => "probe-cell"} style={() => style} />
			<CellSlider label='Slider' defaultValue={30} className={() => "probe-slider"} style={() => style} />
			<CellSwitch label='Switch' className={({ isSelected }) => `probe-switch ${isSelected ? "probe-selected" : "probe-unselected"}`} style={({ isSelected }) => ({ ...style, opacity: isSelected ? 0.9 : 0.7 })} />
			<CellColorPicker label='Color' className='probe-color' />
			<ListView aria-label='Static list' className='probe-list' style={style}>
				<ListView.Item id='static' textValue='Static' className='probe-item' style={style}>
					Static
				</ListView.Item>
			</ListView>
			{[false, true].map((virtualized) => (
				<ListView key={String(virtualized)} virtualized={virtualized} height={140} aria-label={virtualized ? "Virtual list" : "Function list"} selectionMode='single' className={() => (virtualized ? "probe-virtual" : "probe-function")} style={() => ({ ...style, height: 99, padding: 9 })}>
					<ListView.Item id='function' textValue='Function' className={({ isSelected }) => `probe-function-item ${isSelected ? "probe-selected" : "probe-unselected"}`} style={({ isSelected }) => ({ opacity: isSelected ? 0.9 : 0.7 })}>
						{({ isSelected }) => (isSelected ? "Selected row" : "Select row")}
					</ListView.Item>
				</ListView>
			))}
		</div>
	);
}
