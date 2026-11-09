"use client";

import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useMemo } from "react";
import { formatCents } from "@/lib/client";
import { Icon } from "./Icon";

ModuleRegistry.registerModules([AllCommunityModule]);

export type SaleRow = {
  id: string;
  createdAt: string;
  lines: { name: string; qty: number }[];
  totalCents: number;
  method: "paypal" | "venmo";
  status: "CREATED" | "CAPTURED" | "ATTENTION";
  captureId?: string;
  attentionReason?: string;
};

const theme = themeQuartz.withParams({
  fontFamily: "var(--font-body)",
  headerFontFamily: "var(--font-body)",
  accentColor: "#f5a524",
  borderColor: "#e4ddd2",
  headerBackgroundColor: "#f7f5f0",
  foregroundColor: "#16130f",
  wrapperBorderRadius: 14,
  rowHeight: 48,
  headerHeight: 44,
  fontSize: 15,
});

function StatusCell({ status }: { status: SaleRow["status"] }) {
  if (status === "CAPTURED")
    return (
      <span className="pill paid">
        <Icon name="check" size={14} /> Paid
      </span>
    );
  if (status === "ATTENTION")
    return (
      <span className="pill attention">
        <Icon name="alert" size={14} /> Needs a look
      </span>
    );
  return <span className="pill sandbox">Pending</span>;
}

/** The owner's ledger of today's payments, sortable and filterable. */
export function SalesGrid({ sales }: { sales: SaleRow[] }) {
  const columns = useMemo<ColDef<SaleRow>[]>(
    () => [
      {
        headerName: "Time",
        field: "createdAt",
        sort: "desc",
        width: 110,
        valueFormatter: (p) => new Date(p.value as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
      {
        headerName: "Items",
        flex: 2,
        minWidth: 200,
        valueGetter: (p) => p.data?.lines.map((l) => `${l.qty} × ${l.name}`).join(", "),
        filter: true,
      },
      { headerName: "Total", field: "totalCents", width: 110, type: "rightAligned", valueFormatter: (p) => formatCents(p.value as number) },
      { headerName: "Paid with", field: "method", width: 120, valueFormatter: (p) => (p.value === "venmo" ? "Venmo" : "PayPal"), filter: true },
      {
        headerName: "Status",
        field: "status",
        width: 150,
        filter: true,
        cellRenderer: (p: { value: SaleRow["status"] }) => <StatusCell status={p.value} />,
        tooltipValueGetter: (p) => p.data?.attentionReason,
      },
      { headerName: "PayPal capture", field: "captureId", flex: 1, minWidth: 170, cellClass: "mono" },
    ],
    [],
  );

  return (
    <div className="sales-grid" role="region" aria-label="Today's sales">
      <AgGridReact<SaleRow>
        theme={theme}
        rowData={sales}
        columnDefs={columns}
        domLayout="autoHeight"
        getRowId={(p) => p.data.id}
        overlayNoRowsTemplate="No payments yet today."
        ensureDomOrder
        suppressCellFocus={false}
      />
    </div>
  );
}
