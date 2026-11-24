import {describe,it,expect,vi} from "vitest";
import {render,screen,fireEvent} from "@testing-library/react";
import {IndicatorActions} from "../pages/trading/indicators/IndicatorActions";
describe("compact indicator actions",()=>{it("keeps actions hidden until opened and invokes the selected action",()=>{const run=vi.fn();render(<IndicatorActions name="HTF" actions={[{label:"Duplicar",run}]}/>);expect(screen.queryByText("Duplicar")).toBeNull();fireEvent.click(screen.getByRole("button",{name:"Mais ações de HTF"}));fireEvent.click(screen.getByRole("button",{name:"Duplicar"}));expect(run).toHaveBeenCalledTimes(1);expect(screen.queryByText("Duplicar")).toBeNull();});});
