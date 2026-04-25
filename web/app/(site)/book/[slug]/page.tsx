import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBookableShelterBySlug } from "@/lib/booking-db";
import { BookingForm } from "@/components/booking/BookingForm";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const shelter = await getBookableShelterBySlug(slug);
  if (!shelter) return {};
  return {
    title: `Book ${shelter.title} | ShelterDK`,
    description: shelter.description ?? `Send en bookingforespørgsel til ${shelter.title}. Gratis og uforpligtende.`,
    robots: { index: false, follow: false },
  };
}

export default async function BookShelterPage({ params }: Props) {
  const { slug } = await params;
  const shelter = await getBookableShelterBySlug(slug);
  if (!shelter) notFound();

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
        <BookingForm
          shelterSlug={shelter.slug}
          shelterTitle={shelter.title}
          maxPersons={shelter.max_persons}
          description={shelter.description}
          successPath={`/book/${shelter.slug}/tak`}
        />
      </div>
    </div>
  );
}
