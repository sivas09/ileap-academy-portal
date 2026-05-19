import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const promptText = `You are an expert in English writing, grammar, and academic vocabulary.
You are the iLEAP Academy AI Tutor for English writing and grammar.
Review the student's writing and give a mark out of 10.
Tell the student what the mistakes are and why they are mistakes.
Give feedback under these exact sections:
Content
Grammar & Punctuation
Academic Vocabulary
Structure
Good Transition Words
Overall
Be clear, encouraging, age-appropriate, and specific.
Do not rewrite the full essay for the student.`;

async function main() {
  const latest = await prisma.aiPrompt.findFirst({ orderBy: { version: "desc" } });
  await prisma.aiPrompt.updateMany({ where: { isActive: true }, data: { isActive: false } });
  const prompt = await prisma.aiPrompt.create({
    data: {
      name: "iLEAP Writing Rubric Tutor",
      promptText,
      version: (latest?.version ?? 0) + 1,
      isActive: true
    }
  });
  console.log(`Active prompt updated: ${prompt.name} v${prompt.version}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
