import Link from "next/link";

import {
  ORDER_STATUS_LABELS,
  formatDate,
  formatGhs,
  formatLongDate,
  isValidIsoDate,
  isValidIsoMonth,
  monthOf,
  relativeDayLabel,
  todayIso,
} from "@bread/shared";

import { MonthCalendar, type CalendarCell } from "@/components/month-calendar";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  QuestionForYou,
} from "@/components/ui";
import {
  listOrders,
  listOrdersForDate,
  listOrderDaysForMonth,
  type OrderWithContext,
} from "@/services/orders";

export const dynamic = "force-dynamic";

/**
 * Orders, as a month at a glance.
 *
 * The calendar is the way in, because the question being asked of this screen
 * is almost always "what is going out on that day" — by the owner planning, or
 * by whoever is standing in for her. Tapping a day opens that day. The flat
 * list of every order is still there behind a tab, for finding one order.
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; month?: string; view?: string }>;
}) {
  const { date, month, view } = await searchParams;
  const today = todayIso();

  // A typed or stale date in the URL is not trusted, the same as everywhere
  // else: anything that is not a real day falls back rather than erroring.
  const openDate = date && isValidIsoDate(date) ? date : null;
  const activeMonth =
    month && isValidIsoMonth(month) ? month : monthOf(openDate ?? today);
  const showList = view === "list";

  if (openDate) {
    return <DayView date={openDate} today={today} />;
  }

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Tap a day to see everything going out on it"
        action={<ButtonLink href="/orders/new">Write down an order</ButtonLink>}
      />

      <div className="mb-8 flex flex-wrap gap-6 border-b border-stone-200">
        <Tab href="/orders" active={!showList}>
          Calendar
        </Tab>
        <Tab href="/orders?view=list" active={showList}>
          Every order
        </Tab>
      </div>

      {showList ? (
        <ListView />
      ) : (
        <CalendarView month={activeMonth} today={today} />
      )}

      <QuestionForYou>
        <p>
          Every order here is for{" "}
          <strong className="font-semibold text-stone-900">one single day</strong>. Customers like
          Baatsonaa Total agree an amount for the whole month, and there is no
          way to write that down yet.
        </p>
        <p>
          <strong className="font-semibold text-stone-900">
            When a customer agrees an amount for the month, how do you decide
            what goes out each day?
          </strong>{" "}
          Do you split it evenly, or do they tell you how much they want each
          morning? And if the month ends and they took less than they agreed,
          do they still pay for the rest?
        </p>
      </QuestionForYou>
    </>
  );
}

async function CalendarView({ month, today }: { month: string; today: string }) {
  const days = await listOrderDaysForMonth(month);

  const cells: Record<string, CalendarCell> = {};
  for (const [date, day] of Object.entries(days)) {
    cells[date] = {
      date,
      href: `/orders?date=${date}`,
      primary: `${day.orderCount} ${day.orderCount === 1 ? "order" : "orders"}`,
      secondary: `${day.quantity.toLocaleString("en-US")} ${day.quantity === 1 ? "loaf" : "loaves"}`,
      tone: "neutral",
    };
  }

  const monthTotal = Object.values(days).reduce(
    (total, day) => total + day.quantity,
    0,
  );

  return (
    <>
      <Card>
        <MonthCalendar
          month={month}
          cells={cells}
          today={today}
          basePath="/orders"
        />
      </Card>

      <p className="mt-4 text-stone-600">
        {monthTotal === 0
          ? "No bread is written down for this month yet."
          : `${monthTotal.toLocaleString("en-US")} loaves written down across this month.`}
      </p>
    </>
  );
}

async function DayView({ date, today }: { date: string; today: string }) {
  const orders = await listOrdersForDate(date);
  const dayLabel = relativeDayLabel(date, today);
  const loaves = orders.reduce((total, entry) => total + entry.quantity, 0);

  return (
    <>
      <PageHeader
        title={formatLongDate(date)}
        subtitle={
          orders.length === 0
            ? "Nothing going out on this day"
            : `${dayLabel ? `${dayLabel} · ` : ""}${orders.length} ${orders.length === 1 ? "order" : "orders"} · ${loaves.toLocaleString("en-US")} ${loaves === 1 ? "loaf" : "loaves"}`
        }
        action={<ButtonLink href="/orders/new">Write down an order</ButtonLink>}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <ButtonLink href={`/orders?month=${monthOf(date)}`} variant="secondary">
          ← Back to the calendar
        </ButtonLink>
        <ButtonLink href={`/distribution?date=${date}`} variant="secondary">
          See the deliveries for this day
        </ButtonLink>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="No orders for this day"
          description="Write down an order for this day and it will show up here."
        />
      ) : (
        <OrderList orders={orders} showDate={false} />
      )}
    </>
  );
}

async function ListView() {
  const orders = await listOrders();

  if (orders.length === 0) {
    return (
      <EmptyState
        title="No orders yet"
        description="Write down an order and it will appear on the deliveries for that day."
      />
    );
  }

  return <OrderList orders={orders} showDate />;
}

function OrderList({
  orders,
  showDate,
}: {
  orders: OrderWithContext[];
  showDate: boolean;
}) {
  return (
    <Card padded={false}>
      <ul className="divide-y divide-stone-100">
        {orders.map((entry) => {
          const dayLabel = relativeDayLabel(entry.order.deliveryDate);

          return (
            <li
              key={entry.order.id}
              className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
            >
              <div className="min-w-48">
                <p className="font-medium text-stone-900">
                  {entry.customerName}
                </p>
                <p className="text-stone-600">
                  {entry.quantity} × {entry.productName}
                </p>
              </div>

              {showDate && (
                <div className="min-w-36">
                  <p className="text-stone-800">
                    {formatDate(entry.order.deliveryDate)}
                  </p>
                  {dayLabel && (
                    <p className="text-sm text-stone-500">{dayLabel}</p>
                  )}
                </div>
              )}

              <Badge
                tone={
                  entry.order.status === "delivered"
                    ? "good"
                    : entry.order.status === "partially_delivered"
                      ? "warn"
                      : entry.order.status === "cancelled"
                        ? "bad"
                        : "neutral"
                }
              >
                {ORDER_STATUS_LABELS[entry.order.status]}
              </Badge>

              <p className="w-32 text-right font-semibold tabular-nums text-stone-900">
                {formatGhs(entry.totalPesewas)}
              </p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "-mb-px flex items-center border-b-2 pb-3 font-medium transition-colors",
        active
          ? "border-stone-900 text-stone-900"
          : "border-transparent text-stone-500 hover:text-stone-900",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
